declare module '@/core/types/route' {
    // Add per-route meta fields for defineRoute(meta); route middlewares read them via `route.meta`.
    // Required fields make the defineRoute argument required.
    interface RouteMeta {
    }
}

export {};
