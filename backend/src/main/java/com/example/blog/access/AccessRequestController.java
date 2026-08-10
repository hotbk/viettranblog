package com.example.blog.access;

import com.example.blog.user.User;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Member-facing "request access to this private post" flow. No SecurityConfig
 * matcher needed — falls under the existing `anyRequest().authenticated()`
 * catch-all, so any authenticated role can call it (the service layer is what
 * actually enforces ACTIVE-only, not the route).
 */
@RestController
@RequestMapping("/api/access-requests")
public class AccessRequestController {

    private final AccessRequestService accessRequestService;
    private final PostAccessService postAccessService;

    public AccessRequestController(AccessRequestService accessRequestService, PostAccessService postAccessService) {
        this.accessRequestService = accessRequestService;
        this.postAccessService = postAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccessRequestResponse create(@Valid @RequestBody AccessRequestRequest request) {
        User user = currentUserOrThrow();
        return accessRequestService.create(user.getId(), request);
    }

    @GetMapping("/me")
    public List<AccessRequestResponse> mine() {
        User user = currentUserOrThrow();
        return accessRequestService.listMine(user.getId());
    }

    private User currentUserOrThrow() {
        User user = postAccessService.currentUserOrNull();
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return user;
    }
}
