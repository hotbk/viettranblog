package com.example.blog.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    /**
     * Must stay in sync with the default fallback in application.yml
     * ({@code blog.jwt.secret: ${JWT_SECRET:dev-secret-do-not-use-in-production-32chars}}).
     */
    static final String DEFAULT_DEV_SECRET = "dev-secret-do-not-use-in-production-32chars";

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${blog.jwt.secret}") String secret,
            @Value("${blog.jwt.expiration-ms}") long expirationMs,
            Environment environment) {
        validateSecret(secret, environment);
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /**
     * Fails fast at startup if the application is running outside dev/test
     * profiles but is still using the well-known insecure default JWT secret.
     * This prevents an accidental production deployment (or a freshly
     * misconfigured environment) from silently signing tokens with a secret
     * that is public in source control.
     */
    static void validateSecret(String secret, Environment environment) {
        List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
        boolean isDevOrTest = activeProfiles.contains("dev") || activeProfiles.contains("test");
        if (!isDevOrTest && DEFAULT_DEV_SECRET.equals(secret)) {
            throw new IllegalStateException(
                    "Refusing to start: blog.jwt.secret is still the insecure default value. "
                            + "Set the JWT_SECRET environment variable to a strong, unique secret "
                            + "(32+ chars) before starting outside the 'dev' or 'test' profiles.");
        }
    }

    public String generateToken(String username, String role) {
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    public String extractRole(String token) {
        return parseClaims(token).get("role", String.class);
    }

    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = parseClaims(token);
            return claims.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
