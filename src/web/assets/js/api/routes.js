export const API_ROUTES = Object.freeze({
  auth: Object.freeze({
    status: "/auth/status",
    session: "/auth/me",
    login: "/auth/login",
    logout: "/auth/logout",
  }),
  presence: Object.freeze({
    heartbeat: "/presence/heartbeat",
  }),
  files: Object.freeze({
    list: "/api/files",
    folder: "/api/folder",
    file: "/api/file",
    rename: "/api/rename",
    delete: "/api/delete",
    copy: "/api/copy",
    move: "/api/move",
    upload: "/api/upload",
    download: "/api/download",
    stream: "/api/stream",
  }),
});

export function withQuery(route, parameters) {
  const query = new URLSearchParams(parameters);
  return `${route}?${query}`;
}
