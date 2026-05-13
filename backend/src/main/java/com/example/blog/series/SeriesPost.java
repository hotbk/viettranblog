package com.example.blog.series;

import com.example.blog.post.Post;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "series_posts",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"series_id", "post_id"}),
        @UniqueConstraint(columnNames = {"series_id", "position"})
    }
)
public class SeriesPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "series_id", nullable = false)
    private Series series;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @Column(nullable = false)
    private Integer position;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Series getSeries() { return series; }
    public void setSeries(Series series) { this.series = series; }
    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }
}
