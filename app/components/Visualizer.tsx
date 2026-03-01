"use client";

import { useEffect, useRef } from "react";

const interpolateColor = (
  startColor: number[],
  endColor: number[],
  factor: number
): number[] => {
  const result: number[] = [];
  for (let i = 0; i < startColor.length; i += 1) {
    result[i] = Math.round(
      startColor[i] + factor * (endColor[i] - startColor[i])
    );
  }
  return result;
};

const Visualizer = ({ microphone }: { microphone: MediaRecorder }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;

    const source = audioContext.createMediaStreamSource(microphone.stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number | null = null;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;

      analyser.getByteFrequencyData(dataArray);
      context.clearRect(0, 0, width, height);

      const barWidth = 10;
      let x = 0;
      const startColor = [19, 239, 147];
      const endColor = [20, 154, 251];

      for (const value of dataArray) {
        const barHeight = (value / 255) * height * 2;
        const interpolationFactor = value / 255;
        const color = interpolateColor(startColor, endColor, interpolationFactor);

        context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.1)`;
        context.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      source.disconnect();
      analyser.disconnect();
      void audioContext.close();
    };
  }, [microphone]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
};

export default Visualizer;
