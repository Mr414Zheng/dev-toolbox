import { processJson, type JsonRequest, type JsonResponse } from './json';

const scope = globalThis as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<JsonRequest>) => void): void;
  postMessage(message: JsonResponse): void;
};
scope.addEventListener('message', ({ data }) => {
  scope.postMessage({ id: data.id, ...processJson(data.input, data.action, data.indent) });
});
