package com.example.blog.about;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminAboutController {

    private final AboutService aboutService;

    public AdminAboutController(AboutService aboutService) {
        this.aboutService = aboutService;
    }

    // Same content as the public GET — a distinct admin-scoped path only so it
    // consistently falls under the /api/admin/** -> hasRole(ADMIN) matcher and
    // the edit form doesn't depend on the public endpoint staying unauthenticated.
    @GetMapping("/api/admin/about")
    public AboutResponse get() {
        return aboutService.get();
    }

    @PutMapping("/api/admin/about")
    public AboutResponse update(@RequestBody AboutRequest request) {
        return aboutService.update(request);
    }
}
