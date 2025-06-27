"use client";

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const Converter = dynamic(() => import('@/components/converter'), {
  ssr: false,
  loading: () => (
    <Card className="w-full max-w-lg shadow-2xl bg-card">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold font-headline">Webm2Mp4 Converter</CardTitle>
        <CardDescription className="text-center">
          Quickly and easily convert your WEBM files to MP4 format.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[220px] flex items-center justify-center p-6">
        <div className="flex flex-col items-center text-center">
          <Loader2 className="w-16 h-16 text-primary mb-4 animate-spin" />
          <p className="font-semibold">Loading Converter...</p>
        </div>
      </CardContent>
    </Card>
  ),
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <Converter />
    </main>
  );
}
