let summaryText;
let summaryDiv;

function fetchData() {
    var url = document.getElementById('web-scrap-link').value;

    fetch('/fetch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 'url': url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            document.getElementById('text').value = data.text;
        }
    })
    .catch(error => {
        console.error('Hata:', error);
        alert('Metin çekilirken bir hata oluştu!');
    });
}

function previewFile(input) {
    var file = input.files[0];
    var previewContainer = document.getElementById('previewContainer');

    // Önizleme kutusunu temizle
    previewContainer.innerHTML = '';

    if (file) {
        if (file.type.startsWith('image/')) {
            let reader = new FileReader();

            reader.onload = function (e) {
                var img = document.createElement('img');
                img.src = e.target.result;
                img.alt = 'Preview Image';
                img.classList.add('img-thumbnail');
                previewContainer.appendChild(img);
            };

            reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
            var fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = file.name;
            fileNameSpan.classList.add('file-name');
            previewContainer.appendChild(fileNameSpan);
        } else {
            alert('Desteklenmeyen dosya formatı: ' + file.type);
            return;
        }
    }
}



function scanFile() {
    var fileInput = document.getElementById('fileInput');
    var file = fileInput.files[0];
    var textInput = document.getElementById('text');
    
    if (!file) {
        alert('Dosya seçilmedi.');
        return;
    }

    var formData = new FormData();
    formData.append('document', file);

    fetch('/scan_document', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Hata:', data.error);
            alert('Dosya taranırken bir hata oluştu!');
        } else {
            textInput.value = data.scanned_text;
        }
    })
    .catch(error => {
        console.error('Hata:', error);
        alert('Dosya taranırken bir hata oluştu!');
    });
}




function summarizeText() {
    const text = document.getElementById('text').value;

    fetch('/summarize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'text=' + encodeURIComponent(text)
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        summaryText = data.summary;
        updateSummaryDiv(summaryText);
    })
    .catch(error => {
        console.error('Hata:', error);
        alert('Özetleme sırasında bir hata oluştu!');
    });
}

function updateSummaryDiv(summaryText) {
    if (summaryDiv) {
        const summaryContainer = summaryDiv.querySelector('.summary-container');
        if (summaryContainer) {
            summaryContainer.innerText = summaryText;
        }
    } else {
        summaryDiv = document.createElement('div');
        summaryDiv.classList.add('summary-div');
        summaryDiv.innerHTML = `
        <h3 class="mb-3">Özet:</h3>
        <div class="summary-container">${summaryText}</div>
        <div class="container results-container">
            <div class="dropdown language-btn-group">
                <button class="btn btn-secondary dropdown-toggle" type="button" id="languageDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                    Dil Seçin
                </button>
                <ul class="dropdown-menu" aria-labelledby="languageDropdown">
                    <li><a class="dropdown-item" href="#" onclick="switchLanguage('tr', summaryText)">Türkçe</a></li>
                    <li><a class="dropdown-item" href="#" onclick="switchLanguage('en', summaryText)">İngilizce</a></li>
                    <li><a class="dropdown-item" href="#" onclick="switchLanguage('fr', summaryText)">Fransızca</a></li>
                    <li><a class="dropdown-item" href="#" onclick="switchLanguage('ar', summaryText)">Arapça</a></li>
                    <li><a class="dropdown-item" href="#" onclick="switchLanguage('de', summaryText)">Almanca</a></li>
                </ul>
            </div>
            <button class="btn btn-primary save-btn" onclick="saveResult()">Sonucu Kaydet</button>
            <button class="btn btn-primary back-btn" onclick="goBack()">Geri Dön</button>
        </div>
    `;

        const summaryPage = document.getElementById('summary');
        summaryPage.appendChild(summaryDiv);
    }
}

function saveResult() {
    if (!summaryText) {
        alert('Özet bulunamadı!');
        return;
    }
    
    // Sadece summaryContainer içindeki metni al
    const summaryContainer = summaryDiv.querySelector('.summary-container');
    if (!summaryContainer) {
        alert('Özet konteyneri bulunamadı!');
        return;
    }
    
    const textToSave = summaryContainer.innerText;
    const blob = new Blob([textToSave], { type: 'text/plain' });
    const fileName = 'summary.txt';

    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
}


function goBack() {
    const summaryPage = document.getElementById('summary');
    const summaryDivElement = summaryPage.querySelector('.summary-div');

    if (summaryDivElement) {
        summaryPage.removeChild(summaryDivElement);
    }

    const webScrapLink = document.getElementById('web-scrap-link');
    if (webScrapLink) {
        webScrapLink.value = '';
    } else {
        console.error("Element with ID 'web-scrap-link' not found.");
    }

    const textElement = document.getElementById('text');
    if (textElement) {
        textElement.value = '';
    } else {
        console.error("Element with ID 'text' not found.");
    }

    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.value = '';
    } else {
        console.error("Element with ID 'imageInput' not found.");
    }

    // Global summaryDiv değişkenini sıfırla
    summaryDiv = null;
}



function switchLanguage(lang, summaryText) {
    const summaryContainer = document.querySelector('.summary-container');
    if (!summaryContainer) {
        console.error('Özet konteyneri bulunamadı!');
        return;
    }
    
    if (!summaryText) {
        console.error('Çevrilecek metin bulunamadı!');
        return;
    }

    console.log('Çeviri isteği gönderiliyor:', { text: summaryText, dest_lang: lang });

    fetch('/translate_text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: summaryText,
            dest_lang: lang
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Bir hata oluştu');
        }
        return response.json();
    })
    .then(data => {
        console.log('Çeviri yanıtı alındı:', data); 
       
        const translatedText = data.translated_text; 
        updateSummaryDiv(translatedText);
    })
    .catch(error => {
        console.error('Çeviri hatası:', error);
    });
}
