"use client";

import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
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

type Status = "idle" | "selected" | "converting" | "success" | "error";

export default function Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadFfmpeg = async () => {
      const ffmpeg = ffmpegRef.current;
      const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
          workerURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.worker.js`,
            "text/javascript"
          ),
        });
        setFfmpegLoaded(true);
      } catch (err) {
        console.error(err);
        toast({
          variant: "destructive",
          title: "Failed to load FFmpeg",
          description: "Something went wrong. Please refresh and try again.",
        });
        setStatus("error");
      }
    };
    loadFfmpeg();
  }, [toast]);

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      if (selectedFile.type === "video/webm") {
        setFile(selectedFile);
        setStatus("selected");
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a .webm file.",
        });
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
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
    if (file && ffmpegLoaded) {
      setStatus("converting");
      setProgress(0);
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("progress", ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });

      try {
        await ffmpeg.writeFile("input.webm", await fetchFile(file));
        await ffmpeg.exec(["-i", "input.webm", "output.mp4"]);
        const data = await ffmpeg.readFile("output.mp4");

        const url = URL.createObjectURL(
          new Blob([data], { type: "video/mp4" })
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
      <p className="font-semibold text-destructive">Invalid File Type or Conversion Failed</p>
      <p className="text-sm text-muted-foreground">Please try again with a valid .webm file.</p>
    </div>
  );

  const renderContent = () => {
    if (!ffmpegLoaded) {
      return (
        <div className="flex flex-col items-center text-center">
          <Loader2 className="w-16 h-16 text-primary mb-4 animate-spin" />
          <p className="font-semibold">Loading Converter...</p>
          <p className="text-sm text-muted-foreground">Please wait, this may take a moment.</p>
        </div>
      );
    }
    switch (status) {
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
