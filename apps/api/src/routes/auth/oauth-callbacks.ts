import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleOAuthProvider, MicrosoftOAuthProvider } from '../../services/oauth.js';
import { encryptCredentials, validateOAuthState } from '../../lib/crypto.js';

interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export async function oauthCallbackRoutes(fastify: FastifyInstance): Promise<void> {
  // Google OAuth callback
  fastify.get('/auth/google/callback', {
    onRequest: [fastify.requireAdmin],
  }, async (request: FastifyRequest<{ Querystring: OAuthCallbackQuery }>, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query;

    try {
      // Handle OAuth errors
      if (error) {
        const errorMsg = error_description || error;
        fastify.log.warn({ error, error_description }, 'Google OAuth error');
        return reply.redirect(`${fastify.appConfig.APP_BASE_URL || 'http://localhost:3000'}/connectors?error=${encodeURIComponent(errorMsg)}`);
      }

      // Validate required parameters
      if (!code || !state) {
        return reply.status(400).send({ error: 'Missing required parameters: code or state' });
      }

      // Validate CSRF state (stored in session during OAuth initiation)
      const sessionState = (request.session as any)?.oauth_state;
      if (!validateOAuthState(sessionState, state)) {
        fastify.log.warn({ sessionState, receivedState: state }, 'OAuth state validation failed');
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      // Exchange code for tokens
      const googleProvider = new GoogleOAuthProvider(fastify.appConfig);
      const tokens = await googleProvider.exchangeCodeForTokens(code);
      
      // Validate the access token and get user info
      const userProfile = await googleProvider.validateToken(tokens.access_token);
      
      // Get available calendars
      const calendars = await googleProvider.getCalendars(tokens.access_token);

      // Encrypt and store credentials
      const credentials = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        token_type: tokens.token_type,
        user_profile: userProfile
      };
      
      const encryptedCredentials = encryptCredentials(credentials, fastify.appConfig.ENCRYPTION_KEY);
      
      // Store in session temporarily for the wizard to complete
      (request.session as any).oauth_credentials = {
        type: 'google',
        encrypted: encryptedCredentials.toString('base64'),
        calendars: calendars,
        userProfile: userProfile
      };

      // Clear OAuth state from session
      delete (request.session as any).oauth_state;

      // Redirect back to connector wizard with success
      return reply.redirect(`${fastify.appConfig.APP_BASE_URL || 'http://localhost:3000'}/connectors?success=google&calendars=${calendars.length}`);
      
    } catch (error) {
      fastify.log.error({ err: error }, 'Google OAuth callback failed');
      const errorMsg = error instanceof Error ? error.message : 'OAuth processing failed';
      return reply.redirect(`${fastify.appConfig.APP_BASE_URL || 'http://localhost:3000'}/connectors?error=${encodeURIComponent(errorMsg)}`);
    }
  });

  // Microsoft OAuth callback
  fastify.get('/auth/microsoft/callback', {
    onRequest: [fastify.requireAdmin],
  }, async (request: FastifyRequest<{ Querystring: OAuthCallbackQuery }>, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query;

    try {
      // Handle OAuth errors
      if (error) {
        const errorMsg = error_description || error;
        fastify.log.warn({ error, error_description }, 'Microsoft OAuth error');
        return reply.redirect(`${fastify.appConfig.APP_BASE_URL || 'http://localhost:3000'}/connectors?error=${encodeURIComponent(errorMsg)}`);
      }

      // Validate required parameters
      if (!code || !state) {
        return reply.status(400).send({ error: 'Missing required parameters: code or state' });
      }

      // Validate CSRF state (stored in session during OAuth initiation)
      const sessionState = (request.session as any)?.oauth_state;
      if (!validateOAuthState(sessionState, state)) {
        fastify.log.warn({ sessionState, receivedState: state }, 'OAuth state validation failed');
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      // Exchange code for tokens
      const msProvider = new MicrosoftOAuthProvider(fastify.appConfig);
      const tokens = await msProvider.exchangeCodeForTokens(code);
      
      // Validate the access token and get user info
      const userProfile = await msProvider.validateToken(tokens.access_token);
      
      // Get available calendars
      const calendars = await msProvider.getCalendars(tokens.access_token);

      // Encrypt and store credentials
      const credentials = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        token_type: tokens.token_type,
        user_profile: userProfile
      };
      
      const encryptedCredentials = encryptCredentials(credentials, fastify.appConfig.ENCRYPTION_KEY);
      
      // Store in session temporarily for the wizard to complete
      (request.session as any).oauth_credentials = {
        type: 'microsoft',
        encrypted: encryptedCredentials.toString('base64'),
        calendars: calendars,
        userProfile: userProfile
      };

      // Clear OAuth state from session
      delete (request.session as any).oauth_state;

      // Redirect back to connector wizard with success
      return reply.redirect(`${fastify.appConfig.APP_BASE_URL || 'http://localhost:3000'}/connectors?success=microsoft&calendars=${calendars.length}`);
      
    } catch (error) {
      fastify.log.error({ err: error }, 'Microsoft OAuth callback failed');
      const errorMsg = error instanceof Error ? error.message : 'OAuth processing failed';
      return reply.redirect(`${fastify.appConfig.APP_BASE_URL || 'http://localhost:3000'}/connectors?error=${encodeURIComponent(errorMsg)}`);
    }
  });
}