import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabasePublicEnv } from "./env";

const CONFIGURATION_ROUTE = "/configuracao-indisponivel";

export async function updateSession(request: NextRequest) {
  const env = readSupabasePublicEnv();

  if (!env) {
    if (request.nextUrl.pathname === CONFIGURATION_ROUTE) {
      const unavailableResponse = NextResponse.next();
      unavailableResponse.headers.set(
        "Cache-Control",
        "no-store, max-age=0, must-revalidate",
      );
      return unavailableResponse;
    }

    return NextResponse.redirect(new URL(CONFIGURATION_ROUTE, request.url), 307);
  }

  if (request.nextUrl.pathname === CONFIGURATION_ROUTE) {
    return NextResponse.redirect(new URL("/painel", request.url), 307);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    // Uma indisponibilidade do Auth deve encerrar a sessão sem expor detalhes.
  }

  const publicRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/recuperar-senha");

  if (!user && !publicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && publicRoute) {
    return NextResponse.redirect(new URL("/painel", request.url));
  }

  return response;
}
