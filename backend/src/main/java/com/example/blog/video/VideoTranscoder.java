package com.example.blog.video;

import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Thin wrapper around the ffmpeg/ffprobe binaries. Requires both to be installed and on PATH
 * (devops: `apt-get install ffmpeg` on any host that runs this service).
 *
 * Transcodes to H.264/AAC MP4, capped at 1280px-wide and a bitrate ceiling, to keep stored
 * bytea rows bounded regardless of what the uploader submitted.
 */
@Component
public class VideoTranscoder {

    private static final int PROBE_TIMEOUT_SECONDS = 30;
    private static final int TRANSCODE_TIMEOUT_SECONDS = 300;

    /** Probes duration via ffprobe. Throws if the file isn't readable as media. */
    public int probeDurationSeconds(Path input) {
        List<String> cmd = List.of(
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                input.toString()
        );
        String output = run(cmd, PROBE_TIMEOUT_SECONDS, "ffprobe");
        try {
            double seconds = Double.parseDouble(output.trim());
            return (int) Math.ceil(seconds);
        } catch (NumberFormatException e) {
            throw new VideoProcessingException("Could not read video duration — file may not be a valid video");
        }
    }

    /** Transcodes input to H.264/AAC MP4 at output. Throws on non-zero exit or missing output. */
    public void transcode(Path input, Path output) {
        List<String> cmd = List.of(
                "ffmpeg", "-y", "-i", input.toString(),
                "-vf", "scale='min(1280,iw)':-2",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
                "-maxrate", "1500k", "-bufsize", "3000k",
                "-c:a", "aac", "-b:a", "96k",
                "-movflags", "+faststart",
                output.toString()
        );
        run(cmd, TRANSCODE_TIMEOUT_SECONDS, "ffmpeg");
        try {
            if (output.toFile().length() == 0) {
                throw new VideoProcessingException("Transcoding produced an empty file");
            }
        } catch (SecurityException e) {
            throw new VideoProcessingException("Transcoding failed: output file not accessible", e);
        }
    }

    private String run(List<String> cmd, int timeoutSeconds, String toolName) {
        Process process;
        try {
            process = new ProcessBuilder(cmd).redirectErrorStream(true).start();
        } catch (IOException e) {
            throw new VideoProcessingException(toolName + " is not installed or not on PATH", e);
        }

        StringBuilder outputBuilder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                outputBuilder.append(line).append('\n');
            }
        } catch (IOException e) {
            throw new VideoProcessingException("Failed reading " + toolName + " output", e);
        }

        boolean finished;
        try {
            finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new VideoProcessingException(toolName + " was interrupted", e);
        }

        if (!finished) {
            process.destroyForcibly();
            throw new VideoProcessingException(toolName + " timed out after " + timeoutSeconds + "s");
        }
        if (process.exitValue() != 0) {
            throw new VideoProcessingException(toolName + " failed: " + outputBuilder);
        }
        return outputBuilder.toString();
    }
}
