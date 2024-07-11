<template>
    <div v-html="compiledMarkdown"></div>
</template>

<script>
import MarkdownIt from 'markdown-it';

export default {
    name: 'MarkdownRenderer',
    props: {
        content: {
            type: String,
            required: true
        }
    },
    computed: {
        compiledMarkdown() {
            const md = new MarkdownIt();
            return md.render(this.content);
        }
    }
};
</script>

<style scoped>
.markdown-content {
  line-height: 1.2;
  white-space: normal;
}

.markdown-content p {
  margin-bottom: 0.5em;
}
</style>