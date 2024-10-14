import type { DefaultRequestLocals, DefaultResponseLocals, MiddlewareNext, Request, Response, RouteRecord, Server, UserRouteHandler } from '@kikiutils/hyper-express';
import type { EventEmitter } from 'eventemitter3';

export type MiddlewareHandler<RequestLocals extends {} = {}, ResponseLocals extends {} = {}> = (request: Request<RequestLocals & DefaultRequestLocals>, response: Response<ResponseLocals & DefaultResponseLocals>, next: MiddlewareNext) => void;

interface Route extends RouteRecord {
	app: Server;
	id: number;
	handler: UserRouteHandler & RouteHandlerProperties;
	max_body_length: number;
	path: string;
	path_parameters_key: string[];
	streaming: object;
}

export interface RouteHandlerProperties {}

declare module '@kikiutils/hyper-express' {
	interface Request {
		route?: Route;
	}

	interface ServerLocals {
		eventManager: EventEmitter;
	}
}