package com.example.blog.video;

/** Wraps ffprobe/ffmpeg subprocess failures (missing binary, non-zero exit, unreadable stream). */
public class VideoProcessingException extends RuntimeException {
    public VideoProcessingException(String message) {
        super(message);
    }

    public VideoProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}
