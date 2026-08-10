package com.example.blog.book;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.blog.common.ContentLanguage;
import com.example.blog.common.TranslationLanguageTakenException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Book-side coverage for the dual-language content feature — mirrors
 * PostServiceMultilingualTest's shape (docs/10-multilingual-content.md, BE-L7).
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BookServiceMultilingualTest {

    @Autowired private BookService bookService;
    @Autowired private BookRepository bookRepository;

    private MockMultipartFile pdf() {
        return new MockMultipartFile("file", "book.pdf", "application/pdf", "%PDF-1.4\n%%EOF".getBytes());
    }

    private BookResponse createVi(String slug) {
        BookRequest request = new BookRequest(
                "VI " + slug, slug, "Author", "desc", "Test",
                BookStatus.PUBLISHED, BookVisibility.PUBLIC, BookMetadataVisibility.PUBLIC_METADATA, true,
                ContentLanguage.VI, null);
        return bookService.create(request, pdf(), null);
    }

    @Test
    void creatingALinkedTranslationSharesTheSourcesTranslationGroupId() {
        BookResponse source = createVi("ml-book-source-1");
        BookRequest enRequest = new BookRequest(
                "EN ml-book-source-1", "ml-book-source-1-en", "Author", "desc", "Test",
                BookStatus.DRAFT, BookVisibility.PUBLIC, BookMetadataVisibility.PUBLIC_METADATA, true,
                ContentLanguage.EN, source.id());
        BookResponse en = bookService.create(enRequest, pdf(), null);

        Book sourceEntity = bookRepository.findById(source.id()).orElseThrow();
        Book enEntity = bookRepository.findById(en.id()).orElseThrow();
        assertThat(enEntity.getTranslationGroupId()).isEqualTo(sourceEntity.getTranslationGroupId());
        assertThat(enEntity.getTranslatedFromId()).isEqualTo(source.id());
    }

    @Test
    void creatingASecondBookOfTheSameLanguageInOneGroupIsRejected() {
        BookResponse source = createVi("ml-book-source-2");
        BookRequest dup = new BookRequest(
                "VI dup", "ml-book-source-2-dup", "Author", "desc", "Test",
                BookStatus.PUBLISHED, BookVisibility.PUBLIC, BookMetadataVisibility.PUBLIC_METADATA, true,
                ContentLanguage.VI, source.id());
        assertThatThrownBy(() -> bookService.create(dup, pdf(), null))
                .isInstanceOf(TranslationLanguageTakenException.class);
    }

    @Test
    void deletingTheSourceLeavesTheSiblingIntactWithDanglingReferenceTreatedAsNull() {
        BookResponse source = createVi("ml-book-delete-src");
        BookRequest enRequest = new BookRequest(
                "EN ml-book-delete-src", "ml-book-delete-src-en", "Author", "desc", "Test",
                BookStatus.PUBLISHED, BookVisibility.PUBLIC, BookMetadataVisibility.PUBLIC_METADATA, true,
                ContentLanguage.EN, source.id());
        BookResponse en = bookService.create(enRequest, pdf(), null);

        bookService.delete(source.id());

        assertThat(bookRepository.findById(source.id())).isEmpty();
        Book enEntity = bookRepository.findById(en.id()).orElseThrow();
        assertThat(enEntity.getTranslatedFromId()).isEqualTo(source.id());

        BookResponse adminDetail = bookService.getAdminDetail(en.id());
        assertThat(adminDetail.translationStale()).isFalse();
    }

    @Test
    void unlinkingPutsTheBookInAFreshGroupOfOne() {
        BookResponse source = createVi("ml-book-unlink-src");
        BookRequest enRequest = new BookRequest(
                "EN ml-book-unlink-src", "ml-book-unlink-src-en", "Author", "desc", "Test",
                BookStatus.PUBLISHED, BookVisibility.PUBLIC, BookMetadataVisibility.PUBLIC_METADATA, true,
                ContentLanguage.EN, source.id());
        BookResponse en = bookService.create(enRequest, pdf(), null);

        bookService.linkTranslation(en.id(), null);

        Book enEntity = bookRepository.findById(en.id()).orElseThrow();
        assertThat(enEntity.getTranslationGroupId()).isEqualTo(en.id());
        assertThat(enEntity.getTranslatedFromId()).isNull();
    }

    @Test
    void adminDetailIncludesDraftSiblingButPublicDetailDoesNot() {
        BookResponse source = createVi("ml-book-detail-src");
        BookRequest enRequest = new BookRequest(
                "EN draft", "ml-book-detail-src-en", "Author", "desc", "Test",
                BookStatus.DRAFT, BookVisibility.PUBLIC, BookMetadataVisibility.PUBLIC_METADATA, true,
                ContentLanguage.EN, source.id());
        bookService.create(enRequest, pdf(), null);

        BookResponse publicDetail = bookService.findBySlug("ml-book-detail-src");
        assertThat(publicDetail.translations()).isEmpty();

        BookResponse adminDetail = bookService.getAdminDetail(source.id());
        assertThat(adminDetail.translations()).extracting(BookResponse.TranslationRef::slug)
                .contains("ml-book-detail-src-en");
    }
}
