import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { appConfig } from '@/lib/appconfig';
import { Voices } from '@/lib/constant';
import { APIConfig, Voice, type Usage } from '@/lib/types';
import { auth } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: appConfig.openai.apiKey,
  baseURL: appConfig.openai.baseURL
});

type PostData = {
  input: string;
  voice: Voice;
  usage: Usage;
  config?: APIConfig;
};

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json: PostData = await req.json();
  const { input, voice, usage, config } = json;
  const { model } = usage;

  if (!model || !input || !voice || !Voices.includes(voice)) {
    return NextResponse.json(
      { error: 'Invalid model input and voice parameters' },
      { status: 400 }
    );
  }

  if (appConfig.apiCustomEnabled && config) {
    if (config.token) {
      openai.apiKey = config.token;
    }
    if (config.token && config.baseURL) {
      openai.baseURL = config.baseURL;
    }
  }

  try {
    const res = await openai.audio.speech.create({
      model,
      voice,
      input,
      response_format: 'mp3'
    });
    const buffer = Buffer.from(await res.arrayBuffer());

    return NextResponse.json({
      type: 'audio',
      audio: `data:audio/mp3;base64,${buffer.toString('base64')}`
    });
  } catch (err: any) {
    if (err instanceof OpenAI.APIError) {
      const status = err.status;
      const error = err.error as Record<string, any>;
      return NextResponse.json({ error: error.message }, { status });
    } else {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
}
