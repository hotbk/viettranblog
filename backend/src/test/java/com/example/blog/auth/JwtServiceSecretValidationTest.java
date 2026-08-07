package com.example.blog.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/**
 * Unit tests for the fail-fast JWT secret check in {@link JwtService}.
 *
 * These exercise {@link JwtService#validateSecret(String, org.springframework.core.env.Environment)}
 * directly (without booting a Spring context) to keep the tests fast and focused on the
 * defense-in-depth rule: the well-known default JWT secret must never be usable outside
 * the dev/test profiles.
 */
class JwtServiceSecretValidationTest {

    private static final String DEFAULT_SECRET = "dev-secret-do-not-use-in-production-32chars";
    private static final String CUSTOM_SECRET = "a-strong-unique-production-secret-32chars";

    @Test
    void throwsWhenDefaultSecretUsedOutsideDevAndTestProfiles() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        assertThatThrownBy(() -> JwtService.validateSecret(DEFAULT_SECRET, env))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void throwsWhenDefaultSecretUsedWithNoActiveProfileAtAll() {
        // No active profile set at all -- must be treated like production, not like dev.
        MockEnvironment env = new MockEnvironment();

        assertThatThrownBy(() -> JwtService.validateSecret(DEFAULT_SECRET, env))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void doesNotThrowWhenDevProfileActiveEvenWithDefaultSecret() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");

        assertThatCode(() -> JwtService.validateSecret(DEFAULT_SECRET, env))
                .doesNotThrowAnyException();
    }

    @Test
    void doesNotThrowWhenTestProfileActiveEvenWithDefaultSecret() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("test");

        assertThatCode(() -> JwtService.validateSecret(DEFAULT_SECRET, env))
                .doesNotThrowAnyException();
    }

    @Test
    void doesNotThrowWhenSecretIsProperlyOverriddenOutsideDevAndTest() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        assertThatCode(() -> JwtService.validateSecret(CUSTOM_SECRET, env))
                .doesNotThrowAnyException();
    }
}
