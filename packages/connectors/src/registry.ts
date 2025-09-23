import { createGoogleAdapter } from './adapters/google.js';
import {
  createMicrosoftAdapter,
  type MicrosoftAdapterOptions
} from './adapters/microsoft.js';
import { createHtmlIcsAdapter } from './adapters/html-ics.js';
import type {
  ConnectorAdapter,
  ConnectorProvider,
  HtmlIcsAdapterOptions
} from './types.js';

export interface ConnectorRegistryOptions {
  microsoft: MicrosoftAdapterOptions;
  htmlIcs?: HtmlIcsAdapterOptions;
}

export interface ConnectorRegistry {
  getAdapter(provider: ConnectorProvider): ConnectorAdapter;
}

export function createConnectorRegistry(options: ConnectorRegistryOptions): ConnectorRegistry {
  const adapters: Partial<Record<ConnectorProvider, ConnectorAdapter>> = {
    google: createGoogleAdapter(),
    microsoft: createMicrosoftAdapter(options.microsoft),
    html_ics: createHtmlIcsAdapter(options.htmlIcs)
  };

  return {
    getAdapter(provider: ConnectorProvider): ConnectorAdapter {
      const adapter = adapters[provider];
      if (!adapter) {
        throw new Error(`Unsupported connector provider: ${provider}`);
      }

      return adapter;
    }
  } satisfies ConnectorRegistry;
}
