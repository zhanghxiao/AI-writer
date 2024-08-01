<template>
  <el-container class="app-container">
    <el-aside :width="isCollapse ? '64px' : '200px'">
      <el-menu
        :collapse="isCollapse"
        :collapse-transition="false"
        class="el-menu-vertical"
        background-color="rgba(255, 255, 255, 0.7)"
        text-color="#304156"
        active-text-color="#409EFF"
        :default-active="activeIndex"
      >
        <el-menu-item index="0" @click="toggleSidebar">
          <i :class="isCollapse ? 'el-icon-s-unfold' : 'el-icon-s-fold'"></i>
          <span slot="title">{{ isCollapse ? '' : '收起菜单' }}</span>
        </el-menu-item>
        <el-menu-item
          v-for="(writer, index) in writers"
          :key="index"
          :index="(index + 1).toString()"
          @click="selectWriter(writer)"
        >
          <img :src="require(`@/assets/${writer.icon}`)" class="writer-icon" />
          <span slot="title">{{ writer.name }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main>
      <h1 class="main-title">全能内容创作助手 - {{ currentWriter ? currentWriter.name : '' }}</h1>
      
      <div class="model-selection">
        <div class="model-group">
          <h3>视觉模型</h3>
          <el-select v-model="selectedVisionModel" placeholder="选择视觉模型">
            <el-option
              v-for="model in visionModels"
              :key="model"
              :label="model"
              :value="model"
            ></el-option>
          </el-select>
        </div>
        <div class="model-group">
          <h3>文本生成模型</h3>
          <el-select v-model="selectedTextModel" placeholder="选择文本模型" @change="onTextModelChange">
            <el-option
              v-for="model in textModels"
              :key="model"
              :label="model"
              :value="model"
            ></el-option>
          </el-select>
        </div>
      </div>
      
      <div class="search-toggle">
        <span>联网检索</span>
        <el-switch
          v-model="searchEnabled"
          @change="onSearchToggle"
        ></el-switch>
      </div>
      <div v-if="searchToggleMessage" class="search-toggle-message">
        {{ searchToggleMessage }}
      </div>
      
      <div class="chat-windows">
        <div class="chat-window" v-if="uploadedImage">
          <h3>视觉模型结果</h3>
          <div class="chat-messages">
            <div v-if="visionResult" class="message assistant">
              <div class="content">
                <MarkdownRenderer :content="visionResult" />
              </div>
              <div class="model-label">{{ selectedVisionModel }}</div>
            </div>
          </div>
        </div>
        
        <div class="chat-window">
          <h3>文本模型结果</h3>
          <div class="chat-messages">
            <div v-if="searchResults" class="message assistant search-results">
              <div class="content">
                <el-collapse>
                  <el-collapse-item title="检索结果">
                    <div v-for="(result, index) in searchResults" :key="index">
                      <h4>{{ result.title }}</h4>
                      <p>{{ result.body }}</p>
                      <a :href="result.href" target="_blank">查看原文</a>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </div>
            <div v-for="message in textMessages" :key="message.id" :class="['message', message.role]">
              <div class="content">
                <MarkdownRenderer :content="message.content" />
              </div>
              <div class="model-label">{{ message.model }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="input-container">
        <el-input
          v-model="userInput"
          :placeholder="currentWriter ? currentWriter.placeholder : '输入提示词...'"
          @keyup.enter.native="sendMessage"
        >
          <template slot="append">
            <el-upload
              class="upload-demo"
              action="#"
              :show-file-list="false"
              :on-change="handleImageUpload"
              :auto-upload="false"
            >
              <i class="el-icon-paperclip"></i>
            </el-upload>
          </template>
        </el-input>
        <el-button @click="sendMessage" type="primary" :loading="isLoading">发送</el-button>
        <el-button @click="regenerateTextContent" icon="el-icon-refresh" :disabled="!canRegenerate">重新生成</el-button>
        <el-button @click="showHistory" icon="el-icon-takeaway-box">历史记录</el-button>
      </div>
      
      <div class="preview-container" v-if="imagePreview">
        <img :src="imagePreview" alt="Preview" class="image-preview"/>
        <i class="el-icon-close close-preview" @click="clearImagePreview"></i>
      </div>
    </el-main>

    <el-dialog title="历史记录" :visible.sync="historyDialogVisible" width="90%">
      <el-table :data="historyRecords" style="width: 100%">
        <el-table-column prop="date" label="日期" width="180"></el-table-column>
        <el-table-column prop="prompt" label="提示词" width="180"></el-table-column>
        <el-table-column prop="model" label="模型"></el-table-column>
        <el-table-column fixed="right" label="操作" width="200">
          <template slot-scope="scope">
            <el-button @click="showHistoryDetail(scope.row)" type="text" size="small">查看详情</el-button>
            <el-button @click="deleteHistoryRecord(scope.row)" type="text" size="small">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog title="历史记录详情" :visible.sync="historyDetailVisible" width="90%">
      <div v-if="selectedHistoryRecord">
        <h3>视觉模型结果</h3>
        <MarkdownRenderer :content="selectedHistoryRecord.visionResult" />
        <h3>文本模型结果</h3>
        <MarkdownRenderer :content="selectedHistoryRecord.textResult" />
      </div>
    </el-dialog>
  </el-container>
</template>

<script>
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';

export default {
  name: 'ContentCreationAssistant',
  components: {
    MarkdownRenderer
  },
  data() {
    return {
      isCollapse: false,
      writers: [
        {
          name: '小红书配文写手',
          icon: 'xiaohongshu-icon.png',
          prompt: `你是小红书爆款写作专家，请你用以下步骤来进行创作，首先分析用户描述的图片内容，并产出 5 个标题（含适当的 emoji 表情），其次根据图片描述产出 1 个正文（每一个段落含有适当的 emoji 表情，文末有合适的 tag 标签）

          一、在小红书标题方面，你会以下技能：
          1. 采用二级标题法进行创作
          2. 你善于使用标题吸引人的特点
          3. 你使用爆款关键词，写标题时，从这个列表中随机选1-2个
          4. 你了解小红书平台的标题特性
          5. 你懂得创作的规则

          二、在小红书正文方面，你会以下技能：
          1. 写作风格
          2. 写作开篇方法
          3. 文本结构
          4. 互动引导方法
          5. 一些小技巧
          6. 爆炸词
          7. 从你生成的稿子中，抽取3-6个seo关键词，生成#标签并放在文章最后
          8. 文章的每句话都尽量口语化、简短
          9. 在每段话的开头使用表情符号，在每段话的结尾使用表情符号，在每段话的中间插入表情符号

          三、结合我给你输入的信息，以及你掌握的标题和正文的技巧，产出内容。请按照如下格式输出内容，只需要格式描述的部分，如果产生其他内容则不输出：
          一. 标题
          [标题1到标题5]
          [换行]
          二. 正文
          [正文]
          标签：[标签]`,
          placeholder: '描述你想要的小红书文案内容...'
        },
        {
          name: '微博文案助手',
          icon: 'weibo-icon.png',
          prompt: `你是一位专业的微博文案写手。请根据用户的要求和图片内容（如果有），创作简洁有力、引人注目的微博内容。请遵循以下指南：

          1. 控制字数在140字以内
          2. 适当使用话题标签（#）和@提及
          3. 考虑如何增加互动性和传播性
          4. 根据内容适当使用表情符号
          5. 如果有图片，请确保文案与图片内容紧密相关
          6. 使用吸引人的开头来抓住读者的注意力
          7. 在文案中加入一个引人点击或转发的吸引点

          请按以下格式输出：
          [微博正文]
          [话题标签和@提及]`,
          placeholder: '描述你想要的微博内容主题...'
        },
        {
          name: '周报总结助手',
          icon: 'weekly-report-icon.png',
          prompt: `你是一位经验丰富的职场周报撰写专家。请根据用户提供的工作内容，生成一份结构清晰、重点突出的周报。请包含以下内容：

          1. 本周完成的主要工作（3-5项）
          2. 工作中遇到的挑战及解决方案
          3. 下周工作计划（2-3项）
          4. 需要协调或帮助的事项（如果有）
          5. 个人成长和学习（可选）

          请使用专业、简洁的语言，突出关键成果和数据。格式如下：

          本周工作总结：
          1. [工作项1]
          2. [工作项2]
          3. [工作项3]

          挑战与解决方案：
          - [挑战1]：[解决方案1]
          - [挑战2]：[解决方案2]

          下周工作计划：
          1. [计划1]
          2. [计划2]

          需协调事项：
          - [协调事项]（如果有）

          个人成长：
          - [成长点]（可选）`,
          placeholder: '描述本周的工作内容...'
        },
        {
          name: '博客文章编写助手',
          icon: 'blog-icon.png',
          prompt: `你是一位专业的博客文章作者。请根据用户提供的主题和图片内容（如果有），创作一篇结构完整、内容丰富的博客文章。请遵循以下指南：

          1. 写一个引人入胜的开头
          2. 创建清晰的主体段落，每个段落聚焦一个要点
          3. 使用相关的例子或数据支持你的观点
          4. 加入子标题以提高可读性
          5. 结尾要有力，总结主要观点并给出行动建议
          6. 文章长度控制在800-1200字
          7. 使用SEO友好的关键词
          8. 如果有图片，确保在文章中适当描述和引用

          请按以下格式输出：

          标题：[吸引人的标题]

          引言：
          [引人入胜的开场白]

          [子标题1]
          [内容]

          [子标题2]
          [内容]

          [子标题3]
          [内容]

          结论：
          [总结和行动建议]

          关键词：[3-5个相关关键词]`,
          placeholder: '输入你想写的博客文章主题...'
        },
        {
          name: 'TikTok脚本编写器',
          icon: 'tiktok-icon.png',
          prompt: `你是一款旨在协助撰写TikTok引人入胜短视频脚本的AI助手。请根据用户提供的主题、目标受众和任何特定元素（包括图片内容，如果有），生成创意、引人入胜且适合平台的脚本。请遵循以下指南：

          1. 脚本长度应控制在15-60秒内
          2. 开场需要在前3秒内吸引观众注意
          3. 内容要简洁、有趣、信息量大
          4. 考虑加入流行的TikTok音乐或声音效果建议
          5. 包含吸引人的视觉描述或转场建议
          6. 结尾要有强烈的号召性用语（CTA）
          7. 考虑加入热门话题标签建议

          请按以下格式输出：

          脚本标题：[朗朗上口的标题]

          开场（0-3秒）：
          [注意力抓取器]

          主体内容（按需分段）：
          [简洁的内容描述，包括视觉和音频建议]

          结尾+CTA（最后5秒）：
          [有力的结束语和行动号召]

          建议话题标签：
          [3-5个相关的热门标签]

          音乐/音效建议：
          [1-2个适合的音乐或音效建议]`,
          placeholder: '描述你的TikTok视频创意...'
        },
        {
          name: 'Facebook广告撰写专家',
          icon: 'facebook-ad-icon.png',
          prompt: `你是经验丰富的Facebook（Meta）广告撰写专家，在数字营销领域拥有广泛的经验。请根据用户提供的产品或服务信息以及图片内容（如果有），创作引人注目的广告文案。请遵循以下指南：

          1. 创作一个简洁有力的标题（最多40个字符）
          2. 撰写引人入胜的主体文本（125个字符以内）
          3. 设计一个清晰的行动号召（CTA）
          4. 考虑目标受众的兴趣和需求
          5. 突出产品/服务的独特卖点（USP）
          6. 如果有图片，确保文案与视觉元素协调一致
          7. 考虑不同的广告位置（新闻推送、右侧栏、Instagram等）
          8. 提供2-3个文案变体以供选择

          请按以下格式输出：

          变体1：
          标题：[朗朗上口的标题]
          主体文本：[引人入胜的描述]
          CTA：[明确的行动号召]

          变体2：
          [按相同格式]

          变体3：
          [按相同格式]

          建议的定向关键词：
          [3-5个相关的定向关键词]`,
          placeholder: '描述你要推广的产品或服务...'
        },
        {
          name: '产品描述编辑器',
          icon: 'product-description-icon.png',
          prompt: `你是一位擅长创作引人入胜、有说服力的产品描述的专家。请根据用户提供的产品信息和图片内容（如果有），创作一个吸引人的产品描述。请遵循以下指南：

          1. 创作一个引人注目的标题（60个字符以内）
          2. 开场需要立即抓住潜在买家的注意力
          3. 突出产品的主要特性和优势（4-6点）
          4. 使用感官语言来描述产品
          5. 解释产品如何解决客户的问题或满足需求
          6. 包含相关的技术规格或尺寸信息
          7. 使用简洁、易懂的语言
          8. 结尾要有明确的购买理由和行动号召
          9. 考虑SEO，适当使用关键词
          10. 如果有图片，确保描述与视觉元素一致

          请按以下格式输出：

          产品名称：[产品名称]

          标题：[吸引人的标题]

          开场：
          [注意力抓取器]

          主要特性和优势：
          - [特性1]：[优势描述]
          - [特性2]：[优势描述]
          - [特性3]：[优势描述]
          - [特性4]：[优势描述]

          产品描述：
          [详细的产品描述，包括感官语言和问题解决方案]

          技术规格：
          - [规格1]
          - [规格2]
          - [规格3]

          为什么选择我们的产品：
          [独特卖点和购买理由]

          行动号召：
          [明确的CTA]

          关键词：[3-5个SEO关键词]`,
          placeholder: '输入产品的基本信息...'
        },
        {
          name: 'Amazon Title Assistant',
          icon: 'amazon-icon.png',
          prompt: `你是一位专门为Amazon产品创作标题和要点描述的专家。请根据用户提供的产品基础参数和图片内容（如果有），创作出吸引人的标题和五点产品描述。请遵循以下指南：

          1. 标题应在200个字符以内
          2. 包含品牌名称、产品名称、关键特性、颜色、尺寸等重要信息
          3. 使用管道符号(|)分隔不同的信息点
          4. 使用正确的大小写，避免全大写
          5. 五点描述应突出产品的主要卖点和优势
          6. 每个要点应以大写字母开头，并以句号结束
          7. 要点应简洁明了，易于快速浏览
          8. 避免使用主观或夸张的描述
          9. 如果有图片，确保描述与视觉元素一致
          10. 注意避免使用Amazon禁止的词语

          请按以下格式输出：

          标题：
          [品牌名] [产品名] | [关键特性1] | [关键特性2] | [颜色] | [尺寸/容量]

          五点描述：
          • [要点1]
          • [要点2]
          • [要点3]
          • [要点4]
          • [要点5]`,
          placeholder: '输入产品的基本参数...'
        },
        {
          name: '新闻图片配文写手',
          icon: 'news-icon.png',
          prompt: `你是一位专业的新闻图片配文写手。请根据用户上传的新闻图片和相关背景信息，创作一段简洁、准确、引人入胜的配文。请遵循以下指南：

          1. 配文应该在50-100字之间
          2. 准确描述图片中的关键元素和事件
          3. 提供必要的背景信息或上下文
          4. 使用新闻语言，保持客观中立
          5. 如果适用，包含地点和时间信息
          6. 避免使用主观评论或个人观点
          7. 考虑使用引人注目的开场句
          8. 如果有人物，请描述他们的动作或表情，但不要指名道姓
          9. 如果图片涉及敏感话题，请谨慎措辞

          请按以下格式输出：

          [引人注目的开场句]
          [主要事件或场景描述]
          [背景信息或上下文]
          [如果适用，包含时间和地点]`,
          placeholder: '描述新闻图片的内容和背景...'
        }
      ],
      currentWriter: null,
      userInput: '',
      visionResult: '',
      textMessages: [],
      selectedVisionModel: '',
      selectedTextModel: '',
      visionModels: process.env.VUE_APP_VISION_MODELS.split(','),
      textModels: process.env.VUE_APP_TEXT_MODELS.split(','),
      uploadedImage: null,
      imagePreview: null,
      isLoading: false,
      canRegenerate: false,
      historyDialogVisible: false,
      historyDetailVisible: false,
      historyRecords: [],
      selectedHistoryRecord: null,
      activeIndex: '1',
      searchEnabled: false,
      searchToggleMessage: '',
      searchResults: null
    };
  },
  mounted() {
    this.selectedVisionModel = this.visionModels[0];
    this.selectedTextModel = this.textModels[0];
    this.currentWriter = this.writers[0];
    this.loadHistory();
    this.checkMobileView();
    window.addEventListener('resize', this.checkMobileView);
  },
  methods: {
    toggleSidebar() {
      this.isCollapse = !this.isCollapse;
    },
    selectWriter(writer) {
      this.currentWriter = writer;
    },
    handleImageUpload(file) {
      this.uploadedImage = file.raw;
      this.imagePreview = URL.createObjectURL(file.raw);
    },
    clearImagePreview() {
      this.uploadedImage = null;
      this.imagePreview = null;
    },
    async sendMessage() {
      if (!this.userInput.trim() && !this.uploadedImage) {
        this.$message.error('请输入提示词或上传图片');
        return;
      }

      this.isLoading = true;
      this.visionResult = '';
      this.textMessages = [];
      this.searchResults = null;

      try {
        let visionResult = '';
        if (this.uploadedImage) {
          visionResult = await this.callVisionModel();
        }

        if (this.searchEnabled) {
          await this.performSearch();
        }

        await this.callTextModel(visionResult);
        this.canRegenerate = true;
        this.saveToHistory();
      } catch (error) {
        console.error('Error in message processing:', error);
        this.$message.error('处理消息时出错');
      } finally {
        this.isLoading = false;
      }
    },
     async callVisionModel() {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          const base64Image = reader.result.split(',')[1];
          try {
            const response = await fetch(`${process.env.VUE_APP_API_BASE_URL}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.VUE_APP_API_KEY}`
              },
              body: JSON.stringify({
                model: this.selectedVisionModel,
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "What's in this image?" },
                      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                  }
                ],
                max_tokens: 300
              })
            });

            const data = await response.json();
            const content = data.choices[0].message.content;
            this.visionResult = content;
            resolve(content);
          } catch (error) {
            console.error('Error calling vision model:', error);
            reject('视觉模型调用失败');
          }
        };
        reader.readAsDataURL(this.uploadedImage);
      });
    },
    async performSearch() {
    try {
      const response = await fetch('https://mistpe-search.hf.space/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: this.userInput,
          api_key: process.env.VUE_APP_API_KEY
        })
      });

      const data = await response.json();
      if (data.search_results) {
        this.searchResults = data.search_results;
      }
    } catch (error) {
      console.error('Error performing search:', error);
      this.$message.error('搜索过程中出错');
    }
  },

  async callTextModel(visionResult) {
    const assistantMessage = { id: Date.now() + 1, role: 'assistant', content: '', model: this.selectedTextModel };
    this.textMessages.push(assistantMessage);

    const prompt = this.currentWriter ? this.currentWriter.prompt : '';
    let fullPrompt = `${prompt}\n\n图片描述：${visionResult}\n用户提示词：${this.userInput}`;

    if (this.searchResults) {
      fullPrompt += '\n\n搜索结果：\n' + this.searchResults.map(result => `${result.title}\n${result.body}`).join('\n\n');
    }

    try {
      const response = await fetch(`${process.env.VUE_APP_API_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VUE_APP_API_KEY}`
        },
        body: JSON.stringify({
          model: this.selectedTextModel,
          messages: [{ role: 'user', content: fullPrompt }],
          stream: true
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices[0].delta && data.choices[0].delta.content) {
                result += data.choices[0].delta.content;
                assistantMessage.content = result;
                this.$forceUpdate();
              }
            } catch (error) {
              console.error('Error parsing JSON:', error);
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error calling text model:', error);
      assistantMessage.content = '文本模型调用失败';
    }
  },
    onTextModelChange() {
      this.canRegenerate = this.textMessages.length > 0;
    },
    async regenerateTextContent() {
      if (!this.canRegenerate) return;

      this.isLoading = true;
      try {
        await this.callTextModel(this.visionResult);
        this.saveToHistory();
      } catch (error) {
        console.error('Error regenerating content:', error);
        this.$message.error('重新生成内容时出错');
      } finally {
        this.isLoading = false;
      }
    },
    saveToHistory() {
      const record = {
        date: new Date().toLocaleString(),
        prompt: this.userInput,
        model: this.selectedTextModel,
        visionResult: this.visionResult,
        textResult: this.textMessages[this.textMessages.length - 1].content,
        writer: this.currentWriter ? this.currentWriter.name : '通用助手'
      };
      this.historyRecords.push(record);
      localStorage.setItem('historyRecords', JSON.stringify(this.historyRecords));
    },
    loadHistory() {
      const savedHistory = localStorage.getItem('historyRecords');
      if (savedHistory) {
        this.historyRecords = JSON.parse(savedHistory);
      }
    },
    showHistory() {
      this.historyDialogVisible = true;
    },
    showHistoryDetail(record) {
      this.selectedHistoryRecord = record;
      this.historyDetailVisible = true;
    },
    deleteHistoryRecord(record) {
      const index = this.historyRecords.indexOf(record);
      if (index > -1) {
        this.historyRecords.splice(index, 1);
        localStorage.setItem('historyRecords', JSON.stringify(this.historyRecords));
      }
    },
    checkMobileView() {
      if (window.innerWidth <= 768) {
        this.isCollapse = true;
      } else {
        this.isCollapse = false;
      }
    },
    onSearchToggle(value) {
      this.searchToggleMessage = value
        ? "搜索功能已开启，我现在可以上网查资料啦！😎"
         : "搜索功能已关闭，接下来就看我自由发挥了";
      
      // 设置一个定时器，3秒后清除消息
      setTimeout(() => {
        this.searchToggleMessage = '';
      }, 3000);
    }
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.checkMobileView);
  }
};
</script>

<style scoped>
.app-container {
  background-color: #e0f7fa;
  flex: 1;
  display: flex;
}

.el-container {
  height: 100vh;
}

.el-aside {
  background-color: rgba(255, 255, 255, 0.7);
  transition: width 0.3s;
  height: 100vh;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 200px;
  border-right: none;
}

.el-menu-item {
  color: #333 !important;
  background-color: rgba(255, 255, 255, 0.7) !important;
}

.el-menu-item:hover, .el-menu-item.is-active {
  background-color: #ffffff !important;
  color: #409EFF !important;
}

.writer-icon {
  width: 24px;
  height: 24px;
  margin-right: 5px;
}

.el-main {
  padding: 20px;
  overflow-y: auto;
}

.main-title {
  text-align: center;
  margin-bottom: 20px;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.model-selection {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.model-group {
  width: 46%;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 15px;
}

.model-group h3 {
  margin-bottom: 15px;
  margin-top: 5px;
  font-weight: 600;
  font-size: 20px;
  color: #333;
}

.el-select {
  width: 90%;
}

.search-toggle {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.search-toggle span {
  margin-right: 10px;
}

.search-toggle-message {
  margin-bottom: 10px;
  font-style: italic;
  color: #409EFF;
}

.chat-windows {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  height: calc(100vh - 300px);
}

.chat-window {
  flex: 1;
  overflow-y: auto;
  border-radius: 10px;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chat-window h3 {
  margin-bottom: 15px;
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.chat-messages {
  display: flex;
  flex-direction: column;
}

.message {
  max-width: 80%;
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 15px;
  line-height: 1.4;
  font-size: 14px;
  position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.user {
  align-self: flex-end;
  background-color: #3498db;
  color: white;
}

.assistant {
  align-self: flex-start;
  background-color: rgba(255, 255, 255, 0.9);
  color: #333;
}

.model-label {
  position: absolute;
  bottom: -18px;
  right: 5px;
  font-size: 11px;
  color: #666;
}

.input-container {
  display: flex;
  margin-bottom: 20px;
  gap: 10px;
  align-items: center;
}

.el-input {
  flex-grow: 1;
}

.el-input__inner {
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid #dcdfe6;
  color: #333;
}

.el-button {
  flex-shrink: 0;
  border-radius: 10px;
}

.preview-container {
  position: relative;
  width: 100px;
  height: 100px;
  margin-bottom: 20px;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.close-preview {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  padding: 4px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.el-dialog {
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
}

.el-dialog__title {
  color: #333;
}

.el-table {
  background-color: transparent;
}

.el-table th, .el-table td {
  background-color: transparent;
}

.search-results {
  width: 100%;
  max-width: 100%;
}

@media (max-width: 768px) {
  .model-selection,
  .chat-windows,
  .input-container {
    flex-direction: column;
  }

  .model-group,
  .chat-window,
  .el-input,
  .el-button {
    width: 100%;
  }

  .chat-windows {
    height: calc(100vh - 400px);
  }

  .chat-window {
    height: 300px;
  }
}
</style>
