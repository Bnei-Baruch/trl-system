import * as Sentry from '@sentry/browser';
import {SENTRY_DSN} from './consts';
import version from "../version";

export const updateSentryUser = (user) => {
    Sentry.setUser(user);
}

export const initSentry = () => {
    Sentry.init({
        dsn: `${SENTRY_DSN}`,
        release: version,
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
