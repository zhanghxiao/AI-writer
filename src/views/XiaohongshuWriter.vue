<template>
  <div class="app-container">
    <div class="main">
      <h1 class="main-title">小红书配文写手</h1>
      
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
          placeholder="输入提示词..."
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
    </div>

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
  </div>
</template>

<script>
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';

export default {
  name: 'XiaohongshuWriter',
  components: {
    MarkdownRenderer
  },
  data() {
    return {
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
      selectedHistoryRecord: null
    };
  },
  mounted() {
    this.selectedVisionModel = this.visionModels[0];
    this.selectedTextModel = this.textModels[0];
    this.loadHistory();
  },
  methods: {
    handleImageUpload(file) {
      this.uploadedImage = file.raw;
      this.imagePreview = URL.createObjectURL(file.raw);
    },
    clearImagePreview() {
      this.uploadedImage = null;
      this.imagePreview = null;
    },
    async sendMessage() {
      if (!this.userInput.trim()) {
        this.$message.error('请输入提示词');
        return;
      }

      this.isLoading = true;
      this.visionResult = '';
      this.textMessages = [];

      try {
        let visionResult = '';
        if (this.uploadedImage) {
          visionResult = await this.callVisionModel();
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
    async callTextModel(visionResult) {
      const assistantMessage = { id: Date.now() + 1, role: 'assistant', content: '', model: this.selectedTextModel };
      this.textMessages.push(assistantMessage);

      const prompt = `你是小红书爆款写作专家，请你用以下步骤来进行创作，首先分析用户描述的图片内容，并产出 5 个标题（含适当的 emoji 表情），其次根据图片描述产出 1 个正文（每一个段落含有适当的 emoji 表情，文末有合适的 tag 标签）

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
      标签：[标签]

      图片描述：${visionResult}
      用户提示词：${this.userInput}`;

      try {
        const response = await fetch(`${process.env.VUE_APP_API_BASE_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VUE_APP_API_KEY}`
          },
          body: JSON.stringify({
            model: this.selectedTextModel,
            messages: [{ role: 'user', content: prompt }],
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
            textResult: this.textMessages[this.textMessages.length - 1].content
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
        }
      }
    };
    </script>
    
    <style scoped>
    .app-container {
      min-height: 100vh;
      background-color: #f0f2f5;
      padding: 20px;
      box-sizing: border-box;
    }
    
    .main {
      max-width: 900px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      padding: 30px;
    }
    
    .main-title {
      text-align: center;
      margin-bottom: 20px;
      color: #333;
      font-size: 24px;
    }
    
    .model-selection {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .model-group {
      width: 48%;
    }
    
    .model-group h3 {
      margin-bottom: 10px;
      color: #333;
      font-weight: 600;
    }
    
    .el-select {
      width: 100%;
    }
    
    .chat-windows {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .chat-window {
      flex: 1;
      height: 50vh;
      overflow-y: auto;
      border: 1px solid #e8e8e8;
      border-radius: 12px;
      padding: 15px;
      background-color: #fafafa;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .chat-window h3 {
      margin-bottom: 15px;
      color: #333;
      font-weight: 600;
    }
    
    .chat-messages {
      display: flex;
      flex-direction: column;
    }
    
    .message {
      max-width: 100%;
      margin-bottom: 15px;
      padding: 12px;
      border-radius: 14px;
      line-height: 1.6;
      font-size: 14px;
      position: relative;
    }
    
    .user {
      align-self: flex-end;
      background-color: #1890ff;
      color: white;
    }
    
    .assistant {
      align-self: flex-start;
      background-color: #f0f0f0;
      color: #333;
    }
    
    .model-label {
      position: absolute;
      bottom: -15px;
      right: 10px;
      font-size: 12px;
      color: #999;
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
    
    .el-button {
      flex-shrink: 0;
    }
    
    .el-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .preview-container {
      position: relative;
      width: 120px;
      height: 120px;
      margin-bottom: 20px;
    }
    
    .image-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .close-preview {
      position: absolute;
      top: -10px;
      right: -10px;
      background-color: #fff;
      border-radius: 50%;
      padding: 5px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
    }
    
    .close-preview:hover {
      background-color: #f0f0f0;
      transform: scale(1.1);
    }
    
    @media (max-width: 768px) {
      .model-selection {
        flex-direction: column;
      }
    
      .model-group {
        width: 100%;
        margin-bottom: 15px;
      }
    
      .chat-windows {
        flex-direction: column;
      }
    
      .chat-window {
        height: 300px;
      }
    
      .input-container {
        flex-wrap: wrap;
      }
    
      .el-input {
        width: 100%;
        margin-bottom: 10px;
      }
    
      .el-button {
        flex: 1 1 auto;
      }
    
      .preview-container {
        width: 100%;
        height: auto;
        aspect-ratio: 1 / 1;
      }
    }
    </style>