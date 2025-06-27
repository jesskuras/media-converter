"use client";

import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  FileVideo,
  Loader2,
  CheckCircle2,
  Download,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// By loading FFmpeg via <script> tags, we avoid Next.js build errors.
// We declare the global types for TypeScript.
declare global {
  interface Window {
    FFmpeg: any;
    FFmpegUtil: any;
  }
}

type Status = "loading" | "idle" | "selected" | "converting" | "success" | "error";

export default function Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const ffmpegRef = useRef<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadConverter = async () => {
      setStatus("loading");
      try {
        if (!window.FFmpeg || !window.FFmpegUtil) {
            const loadScript = (src: string) =>
              new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = src;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
                document.head.appendChild(script);
              });
            // Load scripts sequentially to respect dependencies
            await loadScript("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/util.js");
            await loadScript("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js");
        }
        
        const { FFmpeg } = window.FFmpeg;
        
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
        
        await ffmpeg.load({
          coreURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
        });
        
        setStatus("idle");
      } catch (err) {
        console.error("Failed to load FFmpeg:", err);
        toast({
          variant: "destructive",
          title: "Failed to load converter",
          description: err instanceof Error ? err.message : "An unknown error occurred. Please refresh.",
        });
        setStatus("error");
      }
    };
    loadConverter();
  }, [toast]);

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      if (selectedFile.type === "video/webm") {
        setFile(selectedFile);
        setStatus("selected");
        setConvertedUrl(null);
        setProgress(0);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a .webm file.",
        });
        handleReset();
      }
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0] || null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0] || null);
  };
  
  const handleDragEvents = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
        setIsDragging(true);
    } else if (e.type === "dragleave") {
        setIsDragging(false);
    }
  };

  const handleConvertClick = async () => {
    if (file && ffmpegRef.current && status === 'selected') {
      setStatus("converting");
      setProgress(0);
      const ffmpeg = ffmpegRef.current;
      const { fetchFile } = window.FFmpegUtil;

      ffmpeg.on("progress", ({ progress }: { progress: number }) => {
        setProgress(Math.round(progress * 100));
      });

      try {
        await ffmpeg.writeFile("input.webm", await fetchFile(file));
        await ffmpeg.exec(["-i", "input.webm", "output.mp4"]);
        const data = await ffmpeg.readFile("output.mp4");

        const url = URL.createObjectURL(
          new Blob([(data as Uint8Array).buffer], { type: "video/mp4" })
        );
        setConvertedUrl(url);
        setStatus("success");
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Conversion Failed",
          description: "An error occurred during conversion.",
        });
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    }
  };

  const handleReset = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    if (convertedUrl) {
      URL.revokeObjectURL(convertedUrl);
      setConvertedUrl(null);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const renderIdleState = () => (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300",
        isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
      )}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragEnter={handleDragEvents}
      onDragLeave={handleDragEvents}
      onDragOver={handleDragEvents}
    >
      <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
      <p className="font-semibold text-center">Click to upload or drag and drop</p>
      <p className="text-sm text-muted-foreground text-center">WEBM files only</p>
      <Input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="video/webm"
        onChange={handleInputChange}
        disabled={status !== 'idle'}
      />
    </div>
  );

  const renderSelectedState = () => (
    <div className="flex flex-col items-center text-center">
      <FileVideo className="w-16 h-16 text-primary mb-4" />
      <p className="font-semibold truncate w-full px-4" title={file?.name}>
        {file?.name}
      </p>
      {file && (
        <p className="text-sm text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}
    </div>
  );

  const renderConvertingState = () => (
    <div className="flex flex-col items-center text-center">
      <Loader2 className="w-16 h-16 text-primary mb-4 animate-spin" />
      <p className="font-semibold">Converting file...</p>
      <p className="text-sm text-muted-foreground truncate w-full px-4" title={file?.name}>{file?.name}</p>
      <Progress value={progress} className="w-full mt-4" />
      <p className="text-sm font-medium text-primary mt-2">{progress}%</p>
    </div>
  );

  const renderSuccessState = () => (
    <div className="flex flex-col items-center text-center">
      <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
      <p className="font-semibold">Conversion Successful!</p>
      <p className="text-sm text-muted-foreground truncate w-full px-4" title={file?.name?.replace(/\.webm$/, ".mp4")}>{file?.name?.replace(/\.webm$/, ".mp4")}</p>
    </div>
  );
  
  const renderErrorState = () => (
    <div className="flex flex-col items-center text-center">
      <XCircle className="w-16 h-16 text-destructive mb-4" />
      <p className="font-semibold text-destructive">An Error Occurred</p>
      <p className="text-sm text-muted-foreground">Please refresh the page and try again.</p>
    </div>
  );
  
  const renderLoadingState = () => (
     <div className="flex flex-col items-center text-center">
        <Loader2 className="w-16 h-16 text-primary mb-4 animate-spin" />
        <p className="font-semibold">Loading Converter...</p>
        <p className="text-sm text-muted-foreground">Please wait, this may take a moment.</p>
      </div>
  );

  const renderContent = () => {
    switch (status) {
      case "loading":
        return renderLoadingState();
      case "selected":
        return renderSelectedState();
      case "converting":
        return renderConvertingState();
      case "success":
        return renderSuccessState();
      case "error":
          return renderErrorState();
      case "idle":
      default:
        return renderIdleState();
    }
  };
  
  const renderFooter = () => {
    switch (status) {
      case "selected":
        return (
          <div className="flex w-full flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleReset} className="w-full">
              Cancel
            </Button>
            <Button onClick={handleConvertClick} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              Convert to MP4
            </Button>
          </div>
        );
      case "success":
        return (
          <div className="flex w-full flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleReset} className="w-full">
              Convert Another File
            </Button>
            {convertedUrl && (
              <a
                href={convertedUrl}
                download={file?.name.replace(/\.webm$/, ".mp4")}
                className="w-full"
              >
                <Button className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download MP4
                </Button>
              </a>
            )}
          </div>
        );
      case "error":
        return (
          <Button onClick={handleReset} className="w-full">
              Try Again
          </Button>
        )
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-2xl bg-card">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold font-headline">Webm2Mp4 Converter</CardTitle>
        <CardDescription className="text-center">
          Quickly and easily convert your WEBM files to MP4 format.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[220px] flex items-center justify-center p-6">
        {renderContent()}
      </CardContent>
      {renderFooter() && (
        <CardFooter className="p-6">
          {renderFooter()}
        </CardFooter>
      )}
    </Card>
  );
}
