/**
 * Telegram Context Integration
 * ==============================
 * 
 * This file provides utilities for integrating Telegram chat context
 * (Vitaliy's insights & voice messages) into MetaMill product development.
 * 
 * Usage:
 * ```
 * import { getTelegramContext, getVoiceMessages } from './telegram-integration'
 * const chatHistory = getTelegramContext()
 * const voices = getVoiceMessages()
 * ```
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

// Global context location in VS Code
const GLOBAL_CONTEXT_DIR = path.join(os.homedir(), '.gemini/global-context')
const TELEGRAM_CONTEXT_DIR = path.join(GLOBAL_CONTEXT_DIR, 'telegram_context')
const CHAT_FILE = path.join(TELEGRAM_CONTEXT_DIR, 'vitaliy_chat_and_voice_transcripts.txt')
const VOICE_DIR = path.join(TELEGRAM_CONTEXT_DIR)

/**
 * Parse chat transcript into structured data
 */
export function getTelegramContext() {
  try {
    const content = fs.readFileSync(CHAT_FILE, 'utf-8')
    const messages = parseTranscript(content)
    return {
      lastUpdated: new Date(fs.statSync(CHAT_FILE).mtime),
      messageCount: messages.length,
      messages: messages,
      raw: content,
    }
  } catch (error) {
    console.error('Failed to load Telegram context:', error)
    return null
  }
}

/**
 * Get list of voice messages
 */
export function getVoiceMessages() {
  try {
    const files = fs.readdirSync(VOICE_DIR)
    const voiceFiles = files
      .filter(f => f.endsWith('.ogg') && f.startsWith('voice_'))
      .map(f => ({
        filename: f,
        path: path.join(VOICE_DIR, f),
        size: fs.statSync(path.join(VOICE_DIR, f)).size,
        dateTime: extractDateFromVoiceFile(f),
      }))
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())

    return {
      totalCount: voiceFiles.length,
      totalSize: voiceFiles.reduce((sum, f) => sum + f.size, 0),
      files: voiceFiles,
    }
  } catch (error) {
    console.error('Failed to load voice messages:', error)
    return null
  }
}

/**
 * Extract key insights from chat
 */
export function extractInsights() {
  const context = getTelegramContext()
  if (!context) return null

  const insights = {
    productDevelopment: extractTopicMessages(context.messages, ['onboarding', 'user', 'registration', 'product', 'feature']),
    growthStrategy: extractTopicMessages(context.messages, ['growth', 'viral', 'engagement', 'community', 'marketing']),
    technicalInsights: extractTopicMessages(context.messages, ['api', 'code', 'development', 'technical', 'architecture']),
    philosophy: extractTopicMessages(context.messages, ['entrepreneur', 'antigravity', 'saas', 'mindset', 'vibecodding']),
  }

  return insights
}

/**
 * Helper: Parse transcript into structured messages
 */
function parseTranscript(content: string) {
  const lines = content.split('\n')
  const messages: any[] = []
  let currentMessage: any = null

  for (const line of lines) {
    if (line.match(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/)) {
      // New message line
      if (currentMessage) {
        messages.push(currentMessage)
      }
      const [timestamp, ...rest] = line.split('] ')
      currentMessage = {
        timestamp: timestamp.replace('[', ''),
        sender: rest[0] || '',
        content: rest.slice(1).join('] '),
      }
    } else if (currentMessage && line.trim()) {
      currentMessage.content += '\n' + line
    }
  }

  if (currentMessage) {
    messages.push(currentMessage)
  }

  return messages
}

/**
 * Helper: Extract topic-specific messages
 */
function extractTopicMessages(messages: any[], keywords: string[]) {
  return messages
    .filter(msg => {
      const text = (msg.content || '').toLowerCase()
      return keywords.some(kw => text.includes(kw))
    })
    .slice(0, 5)
}

/**
 * Helper: Extract date from voice filename
 */
function extractDateFromVoiceFile(filename: string): Date {
  const match = filename.match(/voice_\d+_(\d{8})_(\d{6})/)
  if (match) {
    const date = match[1] // YYYYMMDD
    const time = match[2] // HHMMSS
    const year = parseInt(date.slice(0, 4))
    const month = parseInt(date.slice(4, 6))
    const day = parseInt(date.slice(6, 8))
    const hour = parseInt(time.slice(0, 2))
    const minute = parseInt(time.slice(2, 4))
    const second = parseInt(time.slice(4, 6))
    return new Date(year, month - 1, day, hour, minute, second)
  }
  return new Date()
}

/**
 * Get context summary for AI context windows
 */
export function getContextSummary(maxLength = 2000) {
  const context = getTelegramContext()
  if (!context) return ''

  const summary = `
# Telegram Context - Vitaliy (@Vetal_1one)

## Chat Summary
Total messages: ${context.messageCount}
Date range: Feb 13-18, 2026

## Key Themes

### Product Development
- User onboarding flows and registration optimization
- Video tutorials for user guidance  
- Unit economics and pricing strategy
- User retention metrics

### Growth & Marketing
- Viral post strategies on Threads
- Community building initiatives
- Engagement mechanics
- Personal branding approach

### Technical Insights
- API integration patterns
- Metrics tracking systems
- Growth automation

### Vibecodding Philosophy
- Solo entrepreneurship approach
- Antigravity & Claude Code workflows
- SaaS/MVP mindset
- AI agents (n8n, make)

## Important: 27 voice messages available for deeper insights
  `.trim()

  return summary.substring(0, maxLength)
}

export default {
  getTelegramContext,
  getVoiceMessages,
  extractInsights,
  getContextSummary,
}
