import * as Sentry from '@sentry/react';
import {Integrations} from '@sentry/tracing';
import {SENTRY_DSN} from './consts';

export const updateSentryUser = (user) => {
    Sentry.setUser(user);
}

export const initSentry = () => {
    Sentry.init({
        dsn: `${SENTRY_DSN}`,
        integrations: [
            new Integrations.BrowserTracing(),
        ],

        // We recommend adjusting this value in production, or using tracesSampler
        // for finer control
        tracesSampleRate: 1.0,
        ignoreErrors: ['ResizeObserver loop limit exceeded'],
    });
}

export const captureException = (exception, data = {}) => {
    Sentry.withScope(scope => {
        scope.setExtras(data);
        Sentry.captureException(exception);
    });
}

export const captureMessage = (title, data = {}, level = 'info') => {
    Sentry.withScope(scope => {
        // Always group by title when reporting manually to Sentry.
        scope.setFingerprint([title]);
        scope.setExtras(data);
        scope.setLevel(level);
        Sentry.captureMessage(title);
    });
}
