import { NextResponse } from "next/server";

export async function POST(req) {
  const { path } = await req.json();

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const listUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/upload`;
  const response = await fetch(listUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: path, limit: 100, offset: 0 }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    return NextResponse.json(
      { error: errorData.message || "Failed to list files" },
      { status: response.status }
    );
  }

  const items = await response.json();
  return NextResponse.json(items);
}
