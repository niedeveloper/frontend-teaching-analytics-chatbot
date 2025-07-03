export async function POST(req) {
  const { email } = await req.json();
  const allowedUsers = [
    "chucmotngaytotlanh.tuananh@gmail.com",
    "nguyentuananh.kmf@gmail.com",
    "mike.nguyen0105@gmail.com",
  ];
  if (allowedUsers.includes(email)) {
    return new Response(JSON.stringify({ allowed: true }), { status: 200 });
  }
  return new Response(JSON.stringify({ allowed: false }), { status: 403 });
}
