import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { GoogleOAuthProvider, MicrosoftOAuthProvider } from '../services/oauth.js';
import { encryptCredentials, generateOAuthState } from '../lib/crypto.js';

// Request/Response schemas
const ConnectorCreateRequestSchema = z.object({
  type: z.enum(['google', 'microsoft', 'html_ics', 'imap', 'self_managed']),
  displayName: z.string().optional(),
  calendars: z.array(z.string()).min(1, 'At least one calendar must be selected'),
  config: z.object({}).optional()
});

const OAuthInitiateRequestSchema = z.object({
  provider: z.enum(['google', 'microsoft'])
});

type ConnectorCreateRequest = z.infer<typeof ConnectorCreateRequestSchema>;
type OAuthInitiateRequest = z.infer<typeof OAuthInitiateRequestSchema>;

export async function connectorsRoutes(fastify: FastifyInstance): Promise<void> {
  
  // GET /connectors - List user's connectors
  fastify.get('/connectors', {
    onRequest: [fastify.requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const connectors = await fastify.prisma.connector.findMany({
        where: {
          ownerId: request.admin.id
        },
        include: {
          calendars: {
            select: {
              id: true,
              providerCalendarId: true,
              displayName: true,
              privacyMode: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return reply.send(connectors);
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to fetch connectors');
      return reply.status(500).send({ error: 'Failed to fetch connectors' });
    }
  });

  // POST /connectors/oauth/initiate - Start OAuth flow
  fastify.post('/connectors/oauth/initiate', {
    onRequest: [fastify.requireAdmin],
    preHandler: [fastify.csrfProtection],
  }, async (request: FastifyRequest<{ Body: OAuthInitiateRequest }>, reply: FastifyReply) => {
    try {
      const { provider } = OAuthInitiateRequestSchema.parse(request.body);
      
      // Generate CSRF state
      const state = generateOAuthState();
      
      // Store state in session for validation
      (request.session as any).oauth_state = state;
      
      // Get provider auth URL
      let authUrl: string;
      if (provider === 'google') {
        const googleProvider = new GoogleOAuthProvider(fastify.appConfig);
        authUrl = googleProvider.getAuthUrl(state);
      } else if (provider === 'microsoft') {
        const msProvider = new MicrosoftOAuthProvider(fastify.appConfig);
        authUrl = msProvider.getAuthUrl(state);
      } else {
        return reply.status(400).send({ error: 'Unsupported provider' });
      }

      return reply.send({ 
        authUrl,
        state // Return state for client-side validation
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Invalid request', 
          details: error.errors 
        });
      }
      
      fastify.log.error({ err: error }, 'Failed to initiate OAuth');
      return reply.status(500).send({ error: 'Failed to initiate OAuth flow' });
    }
  });

  // POST /connectors - Create and persist connector
  fastify.post('/connectors', {
    onRequest: [fastify.requireAdmin],
    preHandler: [fastify.csrfProtection],
  }, async (request: FastifyRequest<{ Body: ConnectorCreateRequest }>, reply: FastifyReply) => {
    try {
      const data = ConnectorCreateRequestSchema.parse(request.body);
      
      // Only handle OAuth connector types for now
      if (!['google', 'microsoft'].includes(data.type)) {
        return reply.status(400).send({ error: 'Only Google and Microsoft connectors are currently supported' });
      }

      // Get OAuth credentials from session (stored by callback handlers)
      const oauthData = (request.session as any)?.oauth_credentials;
      if (!oauthData || oauthData.type !== data.type) {
        return reply.status(400).send({ error: 'No valid OAuth session found. Please complete OAuth flow first.' });
      }

      // Validate selected calendars exist in the OAuth response
      const availableCalendarIds = oauthData.calendars.map((cal: any) => cal.id);
      const invalidCalendars = data.calendars.filter(id => !availableCalendarIds.includes(id));
      if (invalidCalendars.length > 0) {
        return reply.status(400).send({ 
          error: 'Invalid calendar selection', 
          invalidCalendars 
        });
      }

      // Create connector with encrypted credentials
      const connectorResult = await fastify.prisma.$transaction(async (tx) => {
        // Create the connector
        const connector = await tx.connector.create({
          data: {
            ownerId: request.admin.id,
            type: data.type as 'google' | 'microsoft',
            displayName: data.displayName || `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} (${oauthData.userProfile.email})`,
            status: 'pending_validation',
            credentialsEncrypted: Buffer.from(oauthData.encrypted, 'base64'),
            configJson: {
              selectedCalendars: data.calendars,
              userProfile: oauthData.userProfile,
              ...data.config
            }
          }
        });

        // Create calendar records for selected calendars
        const selectedCalendars = oauthData.calendars.filter((cal: any) => 
          data.calendars.includes(cal.id)
        );

        const calendarData = selectedCalendars.map((cal: any) => ({
          connectorId: connector.id,
          providerCalendarId: cal.id,
          displayName: cal.summary,
          privacyMode: 'original_title' as const, // Default privacy mode
          metadata: {
            description: cal.description,
            primary: cal.primary,
            accessRole: cal.accessRole
          }
        }));

        const calendars = await tx.calendar.createMany({
          data: calendarData
        });

        // Create audit log entry
        await tx.auditLog.create({
          data: {
            actorId: request.admin.id,
            action: 'connector_created',
            entityType: 'connector',
            entityId: connector.id,
            metadata: {
              type: data.type,
              calendarsCount: data.calendars.length,
              displayName: connector.displayName
            }
          }
        });

        return { connector, calendarsCreated: calendars.count };
      });

      // Clear OAuth data from session
      delete (request.session as any).oauth_credentials;

      // Schedule validation job
      try {
        await fetch(`${fastify.appConfig.API_BASE_URL || 'http://localhost:3001'}/jobs/schedule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.cookie || '', // Forward session cookie
          },
          body: JSON.stringify({
            connectorId: connectorResult.connector.id,
            pairId: connectorResult.connector.id, // Use connector ID as temporary pair ID for validation jobs
            window: {
              start: new Date().toISOString(),
              end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ahead
            },
            priority: 10, // High priority for validation
            payload: {
              type: 'validation',
              action: 'initial_sync_test'
            }
          })
        });
      } catch (jobError) {
        // Log but don't fail the connector creation
        fastify.log.warn({ err: jobError }, 'Failed to schedule validation job');
      }

      // Return the created connector with calendars
      const connectorWithCalendars = await fastify.prisma.connector.findUnique({
        where: { id: connectorResult.connector.id },
        include: {
          calendars: {
            select: {
              id: true,
              providerCalendarId: true,
              displayName: true,
              privacyMode: true,
              metadata: true
            }
          }
        }
      });

      return reply.status(201).send(connectorWithCalendars);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Invalid request', 
          details: error.errors 
        });
      }
      
      fastify.log.error({ err: error }, 'Failed to create connector');
      return reply.status(500).send({ error: 'Failed to create connector' });
    }
  });

  // GET /connectors/:id - Get specific connector details
  fastify.get('/connectors/:id', {
    onRequest: [fastify.requireAdmin],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const connector = await fastify.prisma.connector.findFirst({
        where: {
          id: request.params.id,
          ownerId: request.admin.id
        },
        include: {
          calendars: {
            select: {
              id: true,
              providerCalendarId: true,
              displayName: true,
              privacyMode: true,
              metadata: true
            }
          }
        }
      });

      if (!connector) {
        return reply.status(404).send({ error: 'Connector not found' });
      }

      return reply.send(connector);
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to fetch connector');
      return reply.status(500).send({ error: 'Failed to fetch connector' });
    }
  });
}