package com.example.blog.access;

import com.example.blog.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * Join entity: which users belong to which access groups. A dedicated entity
 * (not a plain @ManyToMany) because it carries extra columns (grantedAt,
 * grantedBy) — same pattern as series.SeriesPost.
 */
@Entity
@Table(
    name = "user_access_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "access_group_id"})
)
public class UserAccessGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "access_group_id", nullable = false)
    private AccessGroup accessGroup;

    @Column(nullable = false, updatable = false)
    private Instant grantedAt;

    // Admin who added this user to the group; nullable (e.g. system/seed data).
    @Column(name = "granted_by")
    private Long grantedBy;

    @PrePersist
    void onCreate() {
        grantedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public AccessGroup getAccessGroup() { return accessGroup; }
    public void setAccessGroup(AccessGroup accessGroup) { this.accessGroup = accessGroup; }
    public Instant getGrantedAt() { return grantedAt; }
    public void setGrantedAt(Instant grantedAt) { this.grantedAt = grantedAt; }
    public Long getGrantedBy() { return grantedBy; }
    public void setGrantedBy(Long grantedBy) { this.grantedBy = grantedBy; }
}
