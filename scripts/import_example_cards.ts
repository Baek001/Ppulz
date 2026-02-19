import fs from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const CARD_TYPES = ['news', 'bill'] as const;

const cardSchema = z.object({
  card_id: z.string().min(1),
  card_type: z.enum(CARD_TYPES),
  big_category: z.string().min(1),
  sub_category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  default_label: z.string().nullable().optional(),
  country_hint: z.string().nullable().optional(),
  bill_stage: z.string().nullable().optional(),
  version: z.number().int().positive().optional(),
});

const fileSchema = z.array(cardSchema).length(200);

function fail(message: string): never {
  throw new Error(message);
}

async function readCards(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  const json = JSON.parse(raw);
  const cards = fileSchema.parse(json);

  const cardIds = cards.map((card) => card.card_id.trim());
  const uniqueIds = new Set(cardIds);

  if (uniqueIds.size !== cards.length) {
    fail('card_id 중복이 있어 import를 중단합니다.');
  }

  if (cardIds.some((cardId) => cardId.length === 0)) {
    fail('빈 card_id가 있어 import를 중단합니다.');
  }

  const invalidTypeCount = cards.filter((card) => !CARD_TYPES.includes(card.card_type)).length;
  if (invalidTypeCount > 0) {
    fail('card_type이 news/bill 외 값을 포함해 import를 중단합니다.');
  }

  return cards.map((card) => ({
    ...card,
    card_id: card.card_id.trim(),
    version: card.version ?? 1,
  }));
}

async function assertCountIs200(supabase: ReturnType<typeof createClient>) {
  const { count, error } = await supabase.from('example_cards').select('*', {
    count: 'exact',
    head: true,
  });

  if (error) {
    fail(`example_cards row count 조회 실패: ${error.message}`);
  }

  if (count !== 200) {
    fail(`import 실패: example_cards row count=${count ?? 'null'} (기대값: 200)`);
  }
}

async function main() {
  const filePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(process.cwd(), 'data/example_cards.json');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    fail('NEXT_PUBLIC_SUPABASE_URL 환경변수가 필요합니다.');
  }

  if (!serviceRoleKey) {
    fail('SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  }

  const cards = await readCards(filePath);
  const newsCount = cards.filter((card) => card.card_type === 'news').length;
  const billCount = cards.filter((card) => card.card_type === 'bill').length;

  if (cards.length !== 200 || newsCount !== 100 || billCount !== 100) {
    fail(
      `입력 데이터 검증 실패: total=${cards.length}, news=${newsCount}, bill=${billCount} (기대: 200/100/100)`,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: upsertError } = await supabase
    .from('example_cards')
    .upsert(cards, { onConflict: 'card_id' });

  if (upsertError) {
    fail(`upsert 실패: ${upsertError.message}`);
  }

  await assertCountIs200(supabase);

  console.log('example_cards import 성공: 200 rows (news 100 / bill 100)');
}

main().catch((error) => {
  console.error(`[IMPORT_FAILED] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
