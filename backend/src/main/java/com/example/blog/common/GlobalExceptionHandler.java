package com.example.blog.common;

import com.example.blog.access.BookAccessDeniedException;
import com.example.blog.access.DenialReason;
import com.example.blog.access.PostAccessDeniedException;
import com.example.blog.book.BookNotDownloadableException;
import com.example.blog.video.VideoProcessingException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError(exception.getCode(), exception.getMessage()));
    }

    // NOT_AUTHENTICATED -> 401 (no session at all); every other reason is a
    // signed-in user who is correctly identified but not authorized -> 403.
    // Never leaks post content in this response — the caller (PostService)
    // throws this before any content is read into a response body.
    @ExceptionHandler(PostAccessDeniedException.class)
    public ResponseEntity<ApiError> handlePostAccessDenied(PostAccessDeniedException exception) {
        HttpStatus status = exception.getReason() == DenialReason.NOT_AUTHENTICATED
                ? HttpStatus.UNAUTHORIZED
                : HttpStatus.FORBIDDEN;
        return ResponseEntity.status(status)
                .body(new ApiError(exception.getReason().name(), "Access denied"));
    }

    // Same shape/status rule as handlePostAccessDenied above — a distinct handler
    // per module boundary (see BookAccessDeniedException javadoc), not shared logic.
    @ExceptionHandler(BookAccessDeniedException.class)
    public ResponseEntity<ApiError> handleBookAccessDenied(BookAccessDeniedException exception) {
        HttpStatus status = exception.getReason() == DenialReason.NOT_AUTHENTICATED
                ? HttpStatus.UNAUTHORIZED
                : HttpStatus.FORBIDDEN;
        return ResponseEntity.status(status)
                .body(new ApiError(exception.getReason().name(), "Access denied"));
    }

    @ExceptionHandler(BookNotDownloadableException.class)
    public ResponseEntity<ApiError> handleBookNotDownloadable(BookNotDownloadableException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError("BOOK_NOT_DOWNLOADABLE", "This book is not available for download"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse("Validation failed");

        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException exception) {
        String msg = exception.getMessage();
        if ("USERNAME_TAKEN".equals(msg) || "EMAIL_TAKEN".equals(msg)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(msg, msg.equals("USERNAME_TAKEN")
                    ? "Username is already taken"
                    : "Email is already in use"));
        }
        if ("HIGHLIGHT_LIMIT_REACHED".equals(msg)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ApiError(msg, "This book already has the maximum number of highlights"));
        }
        if ("INVALID_HIGHLIGHT_ANCHOR".equals(msg) || "HIGHLIGHT_TEXT_TOO_LONG".equals(msg)
                || "HIGHLIGHT_NOTE_TOO_LONG".equals(msg)) {
            return ResponseEntity.badRequest().body(new ApiError(msg, msg));
        }
        return ResponseEntity.badRequest().body(new ApiError("BAD_REQUEST", msg));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiError("BAD_REQUEST", "Uploaded file exceeds the maximum allowed size"));
    }

    @ExceptionHandler(VideoProcessingException.class)
    public ResponseEntity<ApiError> handleVideoProcessing(VideoProcessingException exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("VIDEO_PROCESSING_ERROR", "Failed to process the uploaded video"));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiError> handleDataAccess(DataAccessException exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("DATABASE_ERROR", "A database error occurred"));
    }
}
