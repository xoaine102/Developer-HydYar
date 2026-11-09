declare module "fengari-web" {
  export const lua: any;
  export const lauxlib: any;
  export const lualib: any;
  export function to_luastring(s: string | number[]): any;
  export function to_jsstring(s: any): string;
}

interface Window {
  pyodide?: any;
  ts?: any;
  initSqlJs?: any;
  loadPyodide?: (opts?: any) => Promise<any>;
}

declare module "*?worker" {
  const WorkerClass: any;
  export default WorkerClass;
}
