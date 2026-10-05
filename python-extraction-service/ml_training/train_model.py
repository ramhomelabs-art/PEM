"""
Lightweight BERT NER Training Script
Optimized for CPU training (FREE - no GPU needed)
Uses DistilBERT for faster training
"""

import json
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    TrainingArguments,
    Trainer,
    DataCollatorForTokenClassification
)
from datasets import Dataset
import numpy as np

print("=" * 60)
print("SMS NER Model Training (CPU Optimized)")
print("=" * 60)

# Entity labels
LABELS = [
    'O',
    'B-AMOUNT', 'I-AMOUNT',
    'B-TYPE', 'I-TYPE',
    'B-MERCHANT', 'I-MERCHANT',
    'B-MODE', 'I-MODE',
    'B-ACCOUNT', 'I-ACCOUNT',
    'B-BANK', 'I-BANK',
    'B-DATE', 'I-DATE',
    'B-REFERENCE', 'I-REFERENCE'
]

label2id = {label: i for i, label in enumerate(LABELS)}
id2label = {i: label for i, label in enumerate(LABELS)}

print(f"\n[1/6] Loading datasets...")
# Load datasets
with open('./data/train.json', 'r', encoding='utf-8') as f:
    train_data = json.load(f)
with open('./data/validation.json', 'r', encoding='utf-8') as f:
    val_data = json.load(f)

print(f"  Train: {len(train_data)} samples")
print(f"  Validation: {len(val_data)} samples")

# Convert to Hugging Face Dataset
train_dataset = Dataset.from_list(train_data)
val_dataset = Dataset.from_list(val_data)

print(f"\n[2/6] Loading DistilBERT model (lightweight, faster training)...")
# Use DistilBERT for faster CPU training
model_name = "distilbert-base-cased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForTokenClassification.from_pretrained(
    model_name,
    num_labels=len(LABELS),
    id2label=id2label,
    label2id=label2id
)

print(f"\n[3/6] Tokenizing datasets...")
def tokenize_and_align_labels(examples):
    """Tokenize and align labels - labels all sub-tokens for better extraction"""
    tokenized_inputs = tokenizer(
        examples['tokens'],
        truncation=True,
        is_split_into_words=True,
        padding='max_length',
        max_length=128
    )
    
    labels = []
    for i, label in enumerate(examples['ner_tags']):
        word_ids = tokenized_inputs.word_ids(batch_index=i)
        label_ids = []
        previous_word_idx = None
        
        for word_idx in word_ids:
            if word_idx is None:
                label_ids.append(-100)
            elif word_idx != previous_word_idx:
                # First sub-token of a word
                label_ids.append(label2id[label[word_idx]])
            else:
                # Subsequent sub-tokens of the same word
                curr_label = label[word_idx]
                if curr_label != 'O':
                    # Change B- to I- for sub-tokens
                    if curr_label.startswith('B-'):
                        new_label = 'I-' + curr_label[2:]
                        label_ids.append(label2id[new_label])
                    else:
                        label_ids.append(label2id[curr_label])
                else:
                    label_ids.append(label2id['O'])
            previous_word_idx = word_idx
        
        labels.append(label_ids)
    
    tokenized_inputs['labels'] = labels
    return tokenized_inputs

tokenized_train = train_dataset.map(
    tokenize_and_align_labels,
    batched=True,
    remove_columns=train_dataset.column_names
)
tokenized_val = val_dataset.map(
    tokenize_and_align_labels,
    batched=True,
    remove_columns=val_dataset.column_names
)

print(f"\n[4/6] Setting up training configuration...")
# Data collator
data_collator = DataCollatorForTokenClassification(tokenizer=tokenizer)

# Training arguments (CPU optimized)
training_args = TrainingArguments(
    output_dir='./models/sms-ner',
    eval_strategy='epoch',
    save_strategy='epoch',
    learning_rate=5e-5,
    per_device_train_batch_size=8,  # Small batch for CPU
    per_device_eval_batch_size=8,
    num_train_epochs=3,  # Reduced epochs for faster training
    weight_decay=0.01,
    logging_steps=20,
    load_best_model_at_end=True,
    metric_for_best_model='eval_loss',
    push_to_hub=False,
    no_cuda=True
)

# Simple metrics
def compute_metrics(eval_preds):
    predictions, labels = eval_preds
    predictions = np.argmax(predictions, axis=2)
    
    # Calculate accuracy
    true_predictions = []
    true_labels = []
    
    for prediction, label in zip(predictions, labels):
        for pred, lab in zip(prediction, label):
            if lab != -100:
                true_predictions.append(pred)
                true_labels.append(lab)
    
    accuracy = np.mean(np.array(true_predictions) == np.array(true_labels))
    return {'accuracy': accuracy}

print(f"\n[5/6] Creating trainer...")
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_train,
    eval_dataset=tokenized_val,
    tokenizer=tokenizer,
    data_collator=data_collator,
    compute_metrics=compute_metrics
)

print(f"\n[6/6] Starting training...")
print("⏱️  This will take approximately 1-2 hours on CPU...")
print("You can monitor progress below:\n")

# Train
trainer.train()

print(f"\n✅ Training complete!")

# Save model
model.save_pretrained('./models/sms-ner-final')
tokenizer.save_pretrained('./models/sms-ner-final')

print(f"\n" + "=" * 60)
print("Model saved to: ./models/sms-ner-final")
print("=" * 60)
print("\nNext step: Test the model with your SMS samples!")
