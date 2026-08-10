package com.example.blog.access;

import com.example.blog.post.Post;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Join entity: which access groups may read a given (private) post. */
@Entity
@Table(
    name = "post_access_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "access_group_id"})
)
public class PostAccessGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "access_group_id", nullable = false)
    private AccessGroup accessGroup;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
    public AccessGroup getAccessGroup() { return accessGroup; }
    public void setAccessGroup(AccessGroup accessGroup) { this.accessGroup = accessGroup; }
}
