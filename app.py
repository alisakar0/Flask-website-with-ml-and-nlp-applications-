from flask import Flask, render_template, request, jsonify
from pygoogletranslation import Translator
from bs4 import BeautifulSoup
import requests
import pdfplumber
import os
import json
import logging
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
from nltk.tokenize import sent_tokenize 
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx
from nltk.sentiment import SentimentIntensityAnalyzer
import nltk

nltk.download('punkt')
nltk.download('vader_lexicon')

app = Flask(__name__, static_folder='static')
results = []
summarys_folder = 'summarys'  

translator = Translator()

def split_text_into_paragraphs(text):
    return text.split('\n\n')  

def build_similarity_matrix(sentences):   
    vectorizer = CountVectorizer().fit_transform(sentences)
    vectors = vectorizer.toarray()
    similarity_matrix = cosine_similarity(vectors)
    return similarity_matrix

def textrank_summary(sentences, num_to_mark): 
    similarity_matrix = build_similarity_matrix(sentences)

    graph = nx.from_numpy_array(similarity_matrix)
    scores = nx.pagerank(graph)

    ranked_sentences = sorted(((scores[i], s) for i, s in enumerate(sentences)), reverse=True)
    return [sentence for score, sentence in ranked_sentences[:num_to_mark]]

def shorten_sentences(sentences, max_words):
    shortened_sentences = []
    for sentence in sentences:
        words = sentence.split()
        if len(words) > max_words:
            shortened = ' '.join(words[:max_words])
        else:
            shortened = sentence
        shortened_sentences.append(shortened)
    return shortened_sentences

def analyze_sentiment(sentence):
    analyzer = SentimentIntensityAnalyzer()
    sentiment_score = analyzer.polarity_scores(sentence)
    return sentiment_score['compound']  

def text_summary(input_text, num_to_mark=6, max_words=40):
    paragraphs = split_text_into_paragraphs(input_text)
    sentences = []
    for paragraph in paragraphs:
        sentences.extend(sent_tokenize(paragraph)) 

    important_sentences = textrank_summary(sentences, num_to_mark=num_to_mark)
    shortened_sentences = shorten_sentences(important_sentences, max_words=max_words)

    ranked_sentences = [(analyze_sentiment(sentence), sentence) for sentence in shortened_sentences]
    ranked_sentences.sort(reverse=True)  

    selected_sentences = [sentence for _, sentence in ranked_sentences[:num_to_mark]]

    summary = ' '.join(selected_sentences)
    return summary

def fetch_text_from_url(url):
    try:
        response = requests.get(url)
        response.raise_for_status()  

        soup = BeautifulSoup(response.text, 'html.parser')
        
        text_elements = soup.find_all(['p'], text=True)
        
        text = ' '.join(element.get_text() for element in text_elements if element.get_text())
        
        return text
    except requests.exceptions.RequestException as e:
        print("Hata:", e)
        return None
    
def enhance_image(image):
    image = image.convert('L')
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2)
    image = image.filter(ImageFilter.SHARPEN)
    return image

def extract_text_from_image(image_path):
    try:
        with Image.open(image_path) as img:
            enhanced_img = enhance_image(img)
            text = pytesseract.image_to_string(enhanced_img, lang='tur')
            text = ' '.join(text.split())
            
            return text.strip()
    except Exception as e:
        return str(e)
    

def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        text = ' '.join(text.split())
        
        return text.strip()
    except Exception as e:
        return str(e)



def translate_text_helper(text, dest_lang):
    try:
        translated_sentences = []
        sentences = sent_tokenize(text)
        for sentence in sentences:
            translated_sentence = translator.translate(sentence, dest=dest_lang).text
            translated_sentences.append(translated_sentence)
        translated_text = ' '.join(translated_sentences)
        return translated_text
    except Exception as e:
        return str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def get_summary():
    if request.method == 'POST':
        text = request.form['text']
        
        summary = text_summary(text)  
        
        result_dict = {'original_text': text, 'summary': summary}
        results.append(result_dict)
        
        return jsonify(result_dict)

@app.route('/fetch', methods=['POST'])
def fetch():
    url = request.json.get('url')
    if not url:
        return jsonify({'error': 'URL not provided'}), 400
    
    text = fetch_text_from_url(url)
    if text is None:
        return jsonify({'error': 'Failed to fetch text from URL'}), 500
    
    return jsonify({'text': text})

@app.route('/scan_document', methods=['POST'])
def handle_scan_document():
    try:
        if 'document' not in request.files:
            return jsonify({'error': 'Dosya yüklenmedi.'}), 400
        
        uploaded_file = request.files['document']
        if uploaded_file.filename == '':
            return jsonify({'error': 'Dosya yüklenmedi.'}), 400
        
        file_ext = uploaded_file.filename.split('.')[-1].lower()
        
        if file_ext == 'pdf':
            pdf_path = 'uploaded_document.pdf'
            uploaded_file.save(pdf_path)
            detected_text = extract_text_from_pdf(pdf_path)
            os.remove(pdf_path)
        else:
            image_path = 'uploaded_image.png'
            uploaded_file.save(image_path)
            detected_text = extract_text_from_image(image_path)
            os.remove(image_path)
        
        return jsonify({'scanned_text': detected_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route('/translate_text', methods=['POST'])
def translate_text_route():
    data = request.get_json()
    if 'text' not in data or 'dest_lang' not in data:
        return jsonify({'error': 'Gerekli veriler eksik'}), 400
    
    text = data['text']
    dest_lang = data['dest_lang']
    translated_text = translate_text_helper(text, dest_lang)  
    
    return jsonify({'translated_text': translated_text})
    

if __name__ == '__main__':
    app.run(debug=True)
