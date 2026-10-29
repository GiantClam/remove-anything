export const dynamic = "force-dynamic";

function retiredResponse() {
  return new Response(
    JSON.stringify({
      error: "Endpoint retired",
      code: "ENDPOINT_RETIRED",
    }),
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

/** This legacy proxy accepted caller-controlled URLs and has been retired. */
export async function GET(_request: Request) {
  return retiredResponse();
}
