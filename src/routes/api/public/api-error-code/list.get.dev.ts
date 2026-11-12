import { objectValues } from 'ts-extras';

// Development only: frontends generate their error code types from this list.
export default defineRoute()((ctx) => ctx.createApiSuccessResponse({
    codes: objectValues(apiErrors)
        .flatMap((namespace) => objectValues(namespace).map((definition) => definition.code))
        .toSorted(),
}));
