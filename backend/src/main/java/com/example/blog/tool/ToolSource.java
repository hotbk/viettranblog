package com.example.blog.tool;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

/**
 * The tool's raw HTML/CSS/JS, split from {@link Tool} into its own table so a
 * bulk listing query can never accidentally load it — mirrors
 * {@code book.BookFile} exactly (see its javadoc). Stored verbatim: no
 * sanitization, no minification, no template wrapping. It is served back
 * byte-for-byte by {@code PublicToolController#raw} and rendered client-side
 * inside a sandboxed iframe (docs/03-architecture.md §4.6) — trust boundary
 * is "only ADMIN can write this", not "this content is safe".
 */
@Entity
@Table(name = "tool_sources")
public class ToolSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tool_id", nullable = false, unique = true)
    private Tool tool;

    @Column(name = "html_source", nullable = false, columnDefinition = "TEXT")
    private String htmlSource;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Tool getTool() { return tool; }
    public void setTool(Tool tool) { this.tool = tool; }
    public String getHtmlSource() { return htmlSource; }
    public void setHtmlSource(String htmlSource) { this.htmlSource = htmlSource; }
}
