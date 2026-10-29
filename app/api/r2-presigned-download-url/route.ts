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

/** This legacy signer accepted caller-controlled R2 keys and has been retired. */
export async function POST(_request: Request) {
  return retiredResponse();
}
