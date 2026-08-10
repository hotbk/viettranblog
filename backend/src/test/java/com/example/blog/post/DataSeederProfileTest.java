package com.example.blog.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.example.blog.access.AccessGroupService;
import com.example.blog.comment.CommentRepository;
import com.example.blog.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Verifies that {@link DataSeeder} is opt-in: it must only register its
 * {@link CommandLineRunner} bean when the "dev" profile is explicitly active,
 * and must never load by default or under a prod-like profile.
 */
class DataSeederProfileTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(DataSeeder.class, MockCollaboratorsConfig.class);

    @Test
    void seederNotRegisteredWithNoActiveProfile() {
        contextRunner.run(context -> {
            assertThat(context).doesNotHaveBean(DataSeeder.class);
            assertThat(context.getBeansOfType(CommandLineRunner.class)).isEmpty();
        });
    }

    @Test
    void seederNotRegisteredUnderProdLikeProfile() {
        contextRunner
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("prod"))
                .run(context -> {
                    assertThat(context).doesNotHaveBean(DataSeeder.class);
                    assertThat(context.getBeansOfType(CommandLineRunner.class)).isEmpty();
                });
    }

    @Test
    void seederRegisteredWhenDevProfileExplicitlyActive() {
        contextRunner
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev"))
                .run(context -> {
                    assertThat(context).hasSingleBean(DataSeeder.class);
                    assertThat(context.getBeansOfType(CommandLineRunner.class)).hasSize(1);
                });
    }

    @Configuration
    static class MockCollaboratorsConfig {
        @Bean
        PostService postService() {
            return mock(PostService.class);
        }

        @Bean
        PostRepository postRepository() {
            return mock(PostRepository.class);
        }

        @Bean
        UserRepository userRepository() {
            return mock(UserRepository.class);
        }

        @Bean
        CommentRepository commentRepository() {
            return mock(CommentRepository.class);
        }

        @Bean
        AccessGroupService accessGroupService() {
            return mock(AccessGroupService.class);
        }

        @Bean
        PasswordEncoder passwordEncoder() {
            return mock(PasswordEncoder.class);
        }
    }
}
