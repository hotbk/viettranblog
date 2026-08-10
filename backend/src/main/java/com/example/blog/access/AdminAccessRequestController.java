package com.example.blog.access;

import com.example.blog.user.UserService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Admin-only (guarded by SecurityConfig's `/api/admin/**` -> hasRole("ADMIN") matcher). */
@RestController
@RequestMapping("/api/admin/access-requests")
public class AdminAccessRequestController {

    private final AccessRequestService accessRequestService;
    private final UserService userService;

    public AdminAccessRequestController(AccessRequestService accessRequestService, UserService userService) {
        this.accessRequestService = accessRequestService;
        this.userService = userService;
    }

    @GetMapping
    public List<AccessRequestResponse> list(@RequestParam(defaultValue = "PENDING") AccessRequestStatus status) {
        return accessRequestService.listByStatus(status);
    }

    @PutMapping("/{id}/approve")
    public AccessRequestResponse approve(@PathVariable Long id, @Valid @RequestBody AccessRequestApproval approval) {
        return accessRequestService.approve(id, approval, userService.currentUserIdOrNull());
    }

    @PutMapping("/{id}/reject")
    public AccessRequestResponse reject(@PathVariable Long id) {
        return accessRequestService.reject(id, userService.currentUserIdOrNull());
    }
}
