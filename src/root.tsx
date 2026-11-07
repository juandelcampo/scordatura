import type { ReactNode } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from 'react-router';
import './styles/global.css';

const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23000'/%3E%3Cpath d='M0 8h32M0 16h32M0 24h32' stroke='%23fff' stroke-width='3'/%3E%3Crect x='17' y='11' width='10' height='10' fill='%23ff3d00'/%3E%3C/svg%3E";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href={ICON} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export function HydrateFallback() {
  return <p style={{ padding: 16 }}>Cargando…</p>;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main style={{ padding: 16 }}>
      <h1>{notFound ? 'Esa página no existe' : 'Algo se rompió'}</h1>
      <p>
        <a href="/">Volver a la consigna</a>
      </p>
    </main>
  );
}
