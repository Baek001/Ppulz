import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';

const requestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

function isAlreadyRegisteredError(error) {
  const message = (error?.message ?? '').toLowerCase();

  return (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('already exists') ||
    message.includes('duplicate key')
  );
}

export async function POST(request) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json(
        {
          error:
            'Server auth environment is missing. Check SUPABASE_SERVICE_ROLE_KEY for temporary signup mode.',
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password format.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    });

    if (error) {
      if (isAlreadyRegisteredError(error)) {
        return NextResponse.json({ error: 'This email is already registered. Please log in.' }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? 'Temporary signup failed.' },
      { status: 500 },
    );
  }
}
