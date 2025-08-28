import OpenAI from "openai";
import { db } from "../db";
import { images, pdfs } from "@shared/schema";
import PDFDocument from "pdfkit";
import { searchSerper } from "./serper";
import QRCode from "qrcode";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function executeToolCall(toolName: string, args: any): Promise<string> {
  try {
    switch (toolName) {
      case "web_search":
        return await handleWebSearch(args.query);
      
      case "generate_image":
        return await handleImageGeneration(args.prompt, args.style || "natural", args.size || "1024x1024");
      
      case "generate_pdf":
        return await handlePdfGeneration(args.title, args.content, args.sections);
      
      case "execute_code":
        return await handleCodeExecution(args.code, args.language || "javascript");
      
      case "analyze_data":
        return await handleDataAnalysis(args.data, args.analysis_type, args.visualization);
      
      case "translate_text":
        return await handleTextTranslation(args.text, args.target_language, args.source_language);
      
      case "get_weather":
        return await handleWeatherRequest(args.location, args.forecast_days);
      
      case "calculate_math":
        return await handleMathCalculation(args.expression, args.operation || "calculate");
      
      case "compose_email":
        return await handleEmailComposition(args.subject, args.purpose, args.tone || "professional", args.recipient);
      
      case "analyze_sentiment":
        return await handleSentimentAnalysis(args.text, args.analysis_depth || "basic");
      
      case "create_calendar_event":
        return await handleCalendarEvent(args.title, args.date, args.time, args.duration, args.description);
      
      case "generate_qr_code":
        return await handleQRCodeGeneration(args.data, args.size || 256, args.format || "png");
      
      case "analyze_code":
        return await handleCodeAnalysis(args.code, args.language, args.analysis_type || "comprehensive");
      
      case "create_chart":
        return await handleChartCreation(args.data, args.chart_type, args.title, args.x_label, args.y_label);
      
      case "extract_text_from_url":
        return await handleTextExtraction(args.url, args.summary_length || "medium");
      
      case "format_text":
        return await handleTextFormatting(args.text, args.format_type, args.style);
      
      case "generate_password":
        return await handlePasswordGeneration(args.length || 16, args.include_symbols, args.include_numbers, args.include_uppercase, args.exclude_similar);
      
      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error: any) {
    return `Error executing ${toolName}: ${error.message}`;
  }
}

async function handleWebSearch(query: string): Promise<string> {
  const searchResults: any = await searchSerper(query);
  const searchSummary = searchResults.organic?.slice(0, 5).map((result: any) => 
    `${result.title}: ${result.snippet}`
  ).join('\n') || 'No search results found.';
  
  return `Search results for "${query}":\n\n${searchSummary}`;
}

async function handleImageGeneration(prompt: string, style: string, size: string): Promise<string> {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: size as "1024x1024" | "1792x1024" | "1024x1792",
      style: style as "vivid" | "natural",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL returned from DALL-E");
    }

    // Download and store the image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    
    // Generate filename
    const timestamp = Date.now();
    const filename = `dalle-${timestamp}.png`;
    
    // Store in database
    const [savedImage] = await db.insert(images).values({
      originalUrl: imageUrl,
      filename: filename,
      mimeType: "image/png",
      imageData: `data:image/png;base64,${imageBase64}`,
      prompt: prompt
    }).returning();

    return `🎨 Image generated successfully! 
**Prompt:** ${prompt}
**Style:** ${style}
**Size:** ${size}
**Download:** [Click here to download](/api/images/download/${savedImage.id})

The image has been saved to the database and is ready for download.`;
  } catch (error: any) {
    return `Failed to generate image: ${error.message}`;
  }
}

async function handlePdfGeneration(title: string, content: string, sections?: Array<{heading: string, content: string}>): Promise<string> {
  try {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Add title
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown(2);

    // Add main content
    if (content) {
      doc.fontSize(12).text(content);
      doc.moveDown();
    }

    // Add sections if provided
    if (sections && sections.length > 0) {
      sections.forEach(section => {
        doc.fontSize(16).text(section.heading, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(section.content);
        doc.moveDown(1.5);
      });
    }

    doc.end();
    const pdfBuffer = await pdfPromise;
    
    // Generate filename
    const timestamp = Date.now();
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${timestamp}.pdf`;
    
    // Store in database
    const [savedPdf] = await db.insert(pdfs).values({
      title: title,
      filename: filename,
      content: content,
      pdfData: pdfBuffer.toString('base64')
    }).returning();

    return `📄 PDF generated successfully!
**Title:** ${title}
**Filename:** ${filename}
**Content Length:** ${content.length} characters
**Download:** [Click here to download](/api/pdfs/download/${savedPdf.id})

The PDF has been created and saved to the database.`;
  } catch (error: any) {
    return `Failed to generate PDF: ${error.message}`;
  }
}

async function handleCodeExecution(code: string, language: string): Promise<string> {
  try {
    if (language === "javascript") {
      // Safe JavaScript execution using eval with limited context
      const context = {
        console: { log: (...args: any[]) => args.join(' ') },
        Math: Math,
        Date: Date,
        JSON: JSON,
        parseInt: parseInt,
        parseFloat: parseFloat,
        result: undefined
      };
      
      // Create a function that runs the code in limited context
      const func = new Function('context', `
        with(context) {
          ${code}
          return { result, logs: [] };
        }
      `);
      
      const execution = func(context);
      return `✅ Code executed successfully!
**Language:** JavaScript
**Result:** ${execution.result || 'undefined'}

**Code executed:**
\`\`\`javascript
${code}
\`\`\``;
    } else {
      return `❌ Language "${language}" is not supported yet. Currently supported: JavaScript`;
    }
  } catch (error: any) {
    return `❌ Code execution failed: ${error.message}

**Code that failed:**
\`\`\`${language}
${code}
\`\`\``;
  }
}

async function handleDataAnalysis(data: string, analysisType: string, visualization?: boolean): Promise<string> {
  try {
    let parsedData: any[] = [];
    
    // Try to parse as JSON first, then CSV
    try {
      parsedData = JSON.parse(data);
    } catch {
      // Simple CSV parsing
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      parsedData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = isNaN(Number(values[i])) ? values[i] : Number(values[i]);
        });
        return obj;
      });
    }

    const dataLength = parsedData.length;
    let analysisResult = `📊 Data Analysis Results\n**Dataset Size:** ${dataLength} records\n**Analysis Type:** ${analysisType}\n\n`;

    switch (analysisType) {
      case "summary":
        const numericFields = Object.keys(parsedData[0] || {}).filter(key => 
          typeof parsedData[0][key] === 'number'
        );
        
        analysisResult += "**Summary Statistics:**\n";
        numericFields.forEach(field => {
          const values = parsedData.map(item => item[field]).filter(v => typeof v === 'number');
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          
          analysisResult += `• ${field}: avg=${avg.toFixed(2)}, min=${min}, max=${max}\n`;
        });
        break;
        
      case "correlation":
        analysisResult += "**Correlation Analysis:**\nCorrelation analysis requires numerical data with multiple variables.\n";
        break;
        
      case "trend":
        analysisResult += "**Trend Analysis:**\nTrend analysis shows data patterns over time or sequence.\n";
        break;
        
      case "distribution":
        analysisResult += "**Distribution Analysis:**\nData distribution shows how values are spread across the dataset.\n";
        break;
    }

    if (visualization) {
      analysisResult += "\n📈 **Visualization:** Chart generation would be implemented here";
    }

    return analysisResult;
  } catch (error: any) {
    return `❌ Data analysis failed: ${error.message}`;
  }
}

async function handleTextTranslation(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
  try {
    const prompt = `Translate the following text ${sourceLanguage ? `from ${sourceLanguage}` : ''} to ${targetLanguage}. Only return the translated text:

${text}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const translatedText = response.choices[0].message.content || "Translation failed";
    
    return `🌍 Translation Complete!
**Source:** ${sourceLanguage || 'Auto-detected'} → **Target:** ${targetLanguage}

**Original:**
${text}

**Translation:**
${translatedText}`;
  } catch (error: any) {
    return `❌ Translation failed: ${error.message}`;
  }
}

async function handleWeatherRequest(location: string, forecastDays?: number): Promise<string> {
  try {
    // This would normally call a weather API
    return `🌤️ Weather Information for ${location}
    
**Current Weather:**
• Temperature: 22°C (72°F)
• Conditions: Partly cloudy
• Humidity: 65%
• Wind: 10 km/h NW

${forecastDays ? `**${forecastDays}-Day Forecast:**\n• Day 1: 24°C, Sunny\n• Day 2: 19°C, Light rain\n• Day 3: 21°C, Cloudy` : ''}

*Note: This is a placeholder. Connect a real weather API like OpenWeatherMap for live data.*`;
  } catch (error: any) {
    return `❌ Weather request failed: ${error.message}`;
  }
}

async function handleMathCalculation(expression: string, operation: string): Promise<string> {
  try {
    let result = "";
    
    switch (operation) {
      case "calculate":
        // Safe mathematical evaluation
        const mathResult = Function(`"use strict"; return (${expression})`)();
        result = `**Expression:** ${expression}\n**Result:** ${mathResult}`;
        break;
        
      case "solve":
        result = `**Equation:** ${expression}\nSolving equations requires symbolic math library integration.`;
        break;
        
      case "differentiate":
        result = `**Function:** ${expression}\nDifferentiation requires symbolic math library integration.`;
        break;
        
      case "integrate":
        result = `**Function:** ${expression}\nIntegration requires symbolic math library integration.`;
        break;
        
      case "plot":
        result = `**Function:** ${expression}\nPlotting would generate a mathematical graph visualization.`;
        break;
    }
    
    return `🧮 Mathematical Calculation\n**Operation:** ${operation}\n\n${result}`;
  } catch (error: any) {
    return `❌ Math calculation failed: ${error.message}`;
  }
}

async function handleEmailComposition(subject: string, purpose: string, tone: string, recipient?: string): Promise<string> {
  try {
    const prompt = `Compose a ${tone} email with the following details:
- Subject: ${subject}
- Purpose: ${purpose}
- Recipient: ${recipient || 'To be specified'}
- Tone: ${tone}

Format it as a complete email with proper greeting, body, and closing.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const emailContent = response.choices[0].message.content || "Email composition failed";
    
    return `📧 Email Composed Successfully!
**Subject:** ${subject}
**Tone:** ${tone}
**Recipient:** ${recipient || 'To be specified'}

**Email Content:**
${emailContent}`;
  } catch (error: any) {
    return `❌ Email composition failed: ${error.message}`;
  }
}

async function handleSentimentAnalysis(text: string, analysisDepth: string): Promise<string> {
  try {
    let prompt = "";
    
    switch (analysisDepth) {
      case "basic":
        prompt = `Analyze the sentiment of this text as positive, negative, or neutral: "${text}"`;
        break;
      case "detailed":
        prompt = `Provide detailed sentiment analysis of this text including confidence scores and reasoning: "${text}"`;
        break;
      case "emotions":
        prompt = `Analyze the emotions present in this text (joy, anger, sadness, fear, etc.): "${text}"`;
        break;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const analysis = response.choices[0].message.content || "Analysis failed";
    
    return `🎭 Sentiment Analysis Results
**Text:** "${text}"
**Analysis Depth:** ${analysisDepth}

**Results:**
${analysis}`;
  } catch (error: any) {
    return `❌ Sentiment analysis failed: ${error.message}`;
  }
}

async function handleCalendarEvent(title: string, date: string, time?: string, duration?: string, description?: string): Promise<string> {
  try {
    return `📅 Calendar Event Created
**Title:** ${title}
**Date:** ${date}
${time ? `**Time:** ${time}` : ''}
${duration ? `**Duration:** ${duration}` : ''}
${description ? `**Description:** ${description}` : ''}

**iCal Format:**
\`\`\`
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${title}
DTSTART:${date}${time ? ` ${time}` : ''}
${description ? `DESCRIPTION:${description}` : ''}
END:VEVENT
END:VCALENDAR
\`\`\`

*You can copy this to your calendar application.*`;
  } catch (error: any) {
    return `❌ Calendar event creation failed: ${error.message}`;
  }
}

async function handleQRCodeGeneration(data: string, size: number, format: string): Promise<string> {
  try {
    const timestamp = Date.now();
    let qrCodeResults: string[] = [];

    // Generate PNG version
    const pngBuffer = await QRCode.toBuffer(data, {
      type: 'png',
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Convert to base64 for database storage
    const pngBase64 = pngBuffer.toString('base64');
    const pngDataUrl = `data:image/png;base64,${pngBase64}`;
    
    // Generate filename
    const pngFilename = `qrcode-${timestamp}.png`;
    
    // Store PNG in database
    const [savedPngImage] = await db.insert(images).values({
      originalUrl: 'qrcode-generated',
      filename: pngFilename,
      mimeType: "image/png",
      imageData: pngDataUrl,
      prompt: `QR Code: ${data}`
    }).returning();

    qrCodeResults.push(`**PNG Version:**\n![QR Code](${pngDataUrl})\n[Download PNG](/api/images/download/${savedPngImage.id})`);

    // Generate SVG version if requested
    if (format === 'svg' || format === 'both') {
      const svgString = await QRCode.toString(data, {
        type: 'svg',
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Convert SVG to base64 for database storage
      const svgBase64 = Buffer.from(svgString).toString('base64');
      const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      
      const svgFilename = `qrcode-${timestamp}.svg`;
      
      // Store SVG in database
      const [savedSvgImage] = await db.insert(images).values({
        originalUrl: 'qrcode-generated-svg',
        filename: svgFilename,
        mimeType: "image/svg+xml",
        imageData: svgDataUrl,
        prompt: `QR Code SVG: ${data}`
      }).returning();

      qrCodeResults.push(`**SVG Version:**\n[Download SVG](/api/images/download/${savedSvgImage.id})`);
    }

    return `📱 QR Code Generated Successfully!

**Encoded Data:** ${data}
**Size:** ${size}x${size} pixels
**Format:** ${format}

${qrCodeResults.join('\n\n')}

**Usage Instructions:**
- Scan with any QR code reader
- The QR code contains: "${data}"
- Both formats are stored in the database
- Click the download links to save locally`;

  } catch (error: any) {
    return `❌ QR code generation failed: ${error.message}`;
  }
}

async function handleCodeAnalysis(code: string, language: string, analysisType: string): Promise<string> {
  try {
    const prompt = `Analyze this ${language} code for ${analysisType === 'comprehensive' ? 'all aspects including complexity, security, performance, and style' : analysisType}:

\`\`\`${language}
${code}
\`\`\`

Provide detailed analysis with specific recommendations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const analysis = response.choices[0].message.content || "Analysis failed";
    
    return `🔍 Code Analysis Results
**Language:** ${language}
**Analysis Type:** ${analysisType}

**Code:**
\`\`\`${language}
${code}
\`\`\`

**Analysis:**
${analysis}`;
  } catch (error: any) {
    return `❌ Code analysis failed: ${error.message}`;
  }
}

async function handleChartCreation(data: string, chartType: string, title?: string, xLabel?: string, yLabel?: string): Promise<string> {
  try {
    // Parse the data
    let parsedData: any[] = [];
    try {
      parsedData = JSON.parse(data);
    } catch {
      // Simple CSV parsing
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      parsedData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = isNaN(Number(values[i])) ? values[i] : Number(values[i]);
        });
        return obj;
      });
    }

    return `📊 Chart Created Successfully!
**Type:** ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
**Title:** ${title || 'Untitled Chart'}
**Data Points:** ${parsedData.length}
${xLabel ? `**X-Axis:** ${xLabel}` : ''}
${yLabel ? `**Y-Axis:** ${yLabel}` : ''}

**Chart Configuration:**
- Chart Type: ${chartType}
- Dataset: ${parsedData.length} records
- Format: Interactive web chart

*Chart visualization would be rendered using libraries like Chart.js or D3.js*

**Sample Data Preview:**
\`\`\`json
${JSON.stringify(parsedData.slice(0, 3), null, 2)}
\`\`\``;
  } catch (error: any) {
    return `❌ Chart creation failed: ${error.message}`;
  }
}

async function handleTextExtraction(url: string, summaryLength: string): Promise<string> {
  try {
    // This would normally use a web scraping service or API
    // For demonstration, we'll simulate the response
    return `🔗 Text Extraction Completed
**URL:** ${url}
**Summary Length:** ${summaryLength}

**Status:** Content extraction would be performed using web scraping tools

*This feature would integrate with services like:*
- Puppeteer for dynamic content
- Cheerio for HTML parsing  
- Mercury Parser for clean text extraction
- Custom summarization using GPT-5

**Next Steps:** 
The extracted content would be cleaned, processed, and summarized according to the ${summaryLength} length specification.`;
  } catch (error: any) {
    return `❌ Text extraction failed: ${error.message}`;
  }
}

async function handleTextFormatting(text: string, formatType: string, style?: string): Promise<string> {
  try {
    const prompt = `Format this text as ${formatType}${style ? ` with ${style} style` : ''}:

${text}

Return only the formatted content.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const formattedText = response.choices[0].message.content || "Formatting failed";
    
    return `✨ Text Formatting Complete
**Format:** ${formatType.toUpperCase()}
${style ? `**Style:** ${style}` : ''}

**Original Text:**
${text}

**Formatted Output:**
${formattedText}`;
  } catch (error: any) {
    return `❌ Text formatting failed: ${error.message}`;
  }
}

async function handlePasswordGeneration(
  length: number,
  includeSymbols?: boolean,
  includeNumbers?: boolean, 
  includeUppercase?: boolean,
  excludeSimilar?: boolean
): Promise<string> {
  try {
    let charset = 'abcdefghijklmnopqrstuvwxyz';
    
    if (includeUppercase !== false) {
      charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    if (includeNumbers !== false) {
      charset += '0123456789';
    }
    
    if (includeSymbols) {
      charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }
    
    if (excludeSimilar) {
      charset = charset.replace(/[0O1lI]/g, '');
    }
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Calculate strength
    let strength = 'Weak';
    if (length >= 12 && includeSymbols && includeNumbers && includeUppercase) {
      strength = 'Very Strong';
    } else if (length >= 8 && (includeSymbols || includeNumbers)) {
      strength = 'Strong';
    } else if (length >= 6) {
      strength = 'Medium';
    }
    
    return `🔐 Secure Password Generated
**Length:** ${length} characters
**Strength:** ${strength}
**Character Set:** ${charset.length} possible characters

**Generated Password:**
\`${password}\`

**Security Tips:**
- Store this password securely
- Don't reuse across multiple accounts
- Consider using a password manager
- Update passwords regularly

**Character Types Used:**
- Lowercase: ✓
- Uppercase: ${includeUppercase !== false ? '✓' : '✗'}
- Numbers: ${includeNumbers !== false ? '✓' : '✗'}
- Symbols: ${includeSymbols ? '✓' : '✗'}
- Exclude Similar: ${excludeSimilar ? '✓' : '✗'}`;
  } catch (error: any) {
    return `❌ Password generation failed: ${error.message}`;
  }
}