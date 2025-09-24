## REST API Spec
```yaml
openapi: 3.0.0
info:
  title: SynCal Admin API
  version: 0.1.0
  description: REST interface for authentication, connector management, calendar pairing, job scheduling, and observability.
servers:
  - url: https://{host}/api
    description: Production server
    variables:
      host:
        default: localhost:3001
        description: Hostname:port of the API service
security:
  - sessionCookie: []
paths:
  /healthz:
    get:
      summary: Health probe for load balancers and readiness checks
      description: Returns 200 when core dependencies (DB, encryption key) are ready; returns 503 on failure.
      responses:
        '200':
          description: Service healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, example: ok }
                  db: { type: string, example: connected }
                  encryptionKey: { type: string, example: ready }
                  time: { type: string, format: date-time }
        '503':
          description: One or more dependencies unhealthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, example: degraded }
                  reason: { type: string }
  /auth/session:
    post:
      summary: Create admin session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '204':
          description: Session established (cookie set)
        '401':
          description: Invalid credentials
    delete:
      summary: Destroy current session
      responses:
        '204':
          description: Session terminated
  /auth/google/callback:
    get:
      summary: OAuth callback for Google (connector authorization)
      description: Handles Google OAuth 2.0 authorization code exchange and persists encrypted credentials under the authenticated admin context.
      parameters:
        - in: query
          name: code
          required: false
          schema: { type: string }
          description: Authorization code from Google; present on success
        - in: query
          name: state
          required: false
          schema: { type: string }
          description: Opaque state for CSRF protection and context
        - in: query
          name: error
          required: false
          schema: { type: string }
          description: Error code when consent fails or is denied
        - in: query
          name: error_description
          required: false
          schema: { type: string }
      responses:
        '302':
          description: Redirects back to the portal with success or error indicator
        '400':
          description: Missing or invalid parameters
        '401':
          description: Requires admin session
  /auth/microsoft/callback:
    get:
      summary: OAuth callback for Microsoft (connector authorization)
      description: Handles Microsoft OAuth 2.0 authorization code exchange and persists encrypted credentials under the authenticated admin context.
      parameters:
        - in: query
          name: code
          required: false
          schema: { type: string }
          description: Authorization code from Microsoft; present on success
        - in: query
          name: state
          required: false
          schema: { type: string }
          description: Opaque state for CSRF protection and context
        - in: query
          name: error
          required: false
          schema: { type: string }
          description: Error code when consent fails or is denied
        - in: query
          name: error_description
          required: false
          schema: { type: string }
      responses:
        '302':
          description: Redirects back to the portal with success or error indicator
        '400':
          description: Missing or invalid parameters
        '401':
          description: Requires admin session
  /connectors:
    get:
      summary: List connectors
      responses:
        '200':
          description: Connector list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Connector'
    post:
      summary: Create connector and trigger validation
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateConnectorRequest'
      responses:
        '201':
          description: Connector created and validation enqueued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Connector'
        '422':
          description: Validation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'
  /connectors/validate:
    post:
      summary: Validate connector configuration without persisting
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ValidateConnectorRequest'
      responses:
        '200':
          description: Validation executed and results returned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConnectorValidationResult'
        '401':
          description: Requires admin session
        '422':
          description: Validation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'
  /connectors/{connectorId}:
    parameters:
      - $ref: '#/components/parameters/ConnectorId'
    get:
      summary: Get connector detail
      responses:
        '200':
          description: Connector detail
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Connector'
    patch:
      summary: Update connector metadata or secrets
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateConnectorRequest'
      responses:
        '200':
          description: Updated connector
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Connector'
  /calendars:
    get:
      summary: List calendars
      responses:
        '200':
          description: Calendar list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Calendar'
    post:
      summary: Register calendar for sync
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateCalendarRequest'
      responses:
        '201':
          description: Calendar created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Calendar'
  /calendars/{calendarId}:
    parameters:
      - $ref: '#/components/parameters/CalendarId'
    delete:
      summary: Remove calendar with optional mirrored purge
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DeleteCalendarRequest'
      responses:
        '202':
          description: Deletion accepted; purge job may run asynchronously
  /pairs:
    post:
      summary: Create or update sync pair configuration
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpsertPairRequest'
      responses:
        '200':
          description: Sync pair stored
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SyncPair'
  /jobs/schedule:
    post:
      summary: Schedule sync jobs for a pair or connector
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScheduleRequest'
      responses:
        '202':
          description: Jobs inserted into queue
  /jobs:
    get:
      summary: List pending and recent jobs
      parameters:
        - in: query
          name: status
          schema:
            type: string
            enum: [pending, in_progress, retrying, failed, completed]
      responses:
        '200':
          description: Job list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/SyncJob'
  /jobs/{jobId}/retry:
    post:
      summary: Force retry of a failed job
      parameters:
        - $ref: '#/components/parameters/JobId'
      responses:
        '202':
          description: Job queued for retry
  /metrics:
    get:
      summary: Prometheus-compatible metrics
      responses:
        '200':
          description: Metrics in text/plain format
          content:
            text/plain:
              schema:
                type: string
components:
  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: syn_session
  parameters:
    ConnectorId:
      name: connectorId
      in: path
      required: true
      schema:
        type: string
        format: uuid
    CalendarId:
      name: calendarId
      in: path
      required: true
      schema:
        type: string
        format: uuid
    JobId:
      name: jobId
      in: path
      required: true
      schema:
        type: string
        format: uuid
  schemas:
    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          format: password
    Connector:
      type: object
      required: [id, type, status, createdAt]
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          enum: [google, microsoft, html_ics, imap, self_managed]
        status:
          type: string
          enum: [pending_validation, validated, disabled]
        displayName:
          type: string
        lastValidatedAt:
          type: string
          format: date-time
        lastSuccessfulFetchAt:
          type: string
          format: date-time
        maskedUrl:
          type: string
        previewEvents:
          type: array
          items:
            $ref: '#/components/schemas/ValidationEventPreview'
        targetCalendarLabel:
          type: string
    CreateConnectorRequest:
      type: object
      required: [type, config]
      properties:
        type:
          type: string
          enum: [google, microsoft, html_ics, imap, self_managed]
        config:
          type: object
          additionalProperties: true
    UpdateConnectorRequest:
      type: object
      properties:
        displayName:
          type: string
        config:
          type: object
          additionalProperties: true
    ValidateConnectorRequest:
      type: object
      required: [type, config]
      properties:
        type:
          type: string
          enum: [google, microsoft, html_ics, imap, self_managed]
        config:
          oneOf:
            - $ref: '#/components/schemas/HtmlIcsConnectorConfig'
            - type: object
              additionalProperties: true
    HtmlIcsConnectorConfig:
      type: object
      required: [feedUrl, targetCalendarLabel]
      properties:
        feedUrl:
          type: string
          format: uri
        authHeader:
          type: string
          nullable: true
        authToken:
          type: string
          nullable: true
        targetCalendarLabel:
          type: string
    ConnectorValidationResult:
      type: object
      required: [status]
      properties:
        status:
          type: string
          enum: [ok, failed]
        maskedUrl:
          type: string
        previewEvents:
          type: array
          items:
            $ref: '#/components/schemas/ValidationEventPreview'
        lastSuccessfulFetchAt:
          type: string
          format: date-time
        issues:
          type: array
          items:
            $ref: '#/components/schemas/ValidationIssue'
    ValidationEventPreview:
      type: object
      required: [uid, summary, startsAt, endsAt]
      properties:
        uid:
          type: string
        summary:
          type: string
        startsAt:
          type: string
          format: date-time
        endsAt:
          type: string
          format: date-time
        allDay:
          type: boolean
    ValidationIssue:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        severity:
          type: string
          enum: [info, warning, error]
    ValidationError:
      type: object
      properties:
        message:
          type: string
        fieldErrors:
          type: array
          items:
            type: object
            properties:
              field: { type: string }
              message: { type: string }
    Calendar:
      type: object
      required: [id, connectorId, providerCalendarId, privacyMode]
      properties:
        id:
          type: string
          format: uuid
        connectorId:
          type: string
          format: uuid
        providerCalendarId:
          type: string
        displayName:
          type: string
        privacyMode:
          type: string
          enum: [original_title, busy_placeholder]
    CreateCalendarRequest:
      type: object
      required: [connectorId, providerCalendarId, privacyMode]
      properties:
        connectorId:
          type: string
          format: uuid
        providerCalendarId:
          type: string
        privacyMode:
          type: string
          enum: [original_title, busy_placeholder]
    DeleteCalendarRequest:
      type: object
      required: [deleteMirrors]
      properties:
        deleteMirrors:
          type: boolean
        reason:
          type: string
    SyncPair:
      type: object
      required: [id, primaryCalendarId, secondaryCalendarId]
      properties:
        id:
          type: string
          format: uuid
        primaryCalendarId:
          type: string
          format: uuid
        secondaryCalendarId:
          type: string
          format: uuid
        fallbackOrder:
          type: array
          items:
            type: string
            format: uuid
    UpsertPairRequest:
      type: object
      required: [primaryCalendarId, secondaryCalendarId]
      properties:
        primaryCalendarId:
          type: string
          format: uuid
        secondaryCalendarId:
          type: string
          format: uuid
        fallbackOrder:
          type: array
          items:
            type: string
            format: uuid
    ScheduleRequest:
      type: object
      required: [pairId, window]
      properties:
        pairId:
          type: string
          format: uuid
        window:
          type: object
          required: [start, end]
          properties:
            start:
              type: string
              format: date-time
            end:
              type: string
              format: date-time
    SyncJob:
      type: object
      required: [id, status, pairId, nextRunAt]
      properties:
        id:
          type: string
          format: uuid
        pairId:
          type: string
          format: uuid
        status:
          type: string
          enum: [pending, in_progress, retrying, failed, completed]
        nextRunAt:
          type: string
          format: date-time
        retryCount:
          type: integer
        lastError:
          type: string
```
```
