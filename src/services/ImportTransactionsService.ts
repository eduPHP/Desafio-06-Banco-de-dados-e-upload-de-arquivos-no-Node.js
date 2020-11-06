import parse from 'csv-parse';
import { getRepository, In } from 'typeorm';
import * as fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface TransactionRecord {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute(file: Express.Multer.File): Promise<Transaction[]> {
    const dataStream = await fs.createReadStream(file.path, 'utf8');

    const parsed = parse({
      from_line: 2,
      trim: true,
    });

    const parseCSV = dataStream.pipe(parsed);

    const transactions: TransactionRecord[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;
      if (!title || !type || !value) return;
      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getRepository(Transaction);

    const searchCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });
    const existentCategories = searchCategories.map(
      (category: Category) => category.title,
    );

    const addCategories = categories
      .filter(category => !existentCategories.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategories.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories: Category[] = [
      ...searchCategories,
      ...newCategories,
    ];
    const createdTransactions = transactionsRepository.create(
      transactions.map(
        transaction =>
          ({
            title: transaction.title,
            value: transaction.value,
            type: transaction.type,
            category: finalCategories.find(
              category => category.title === transaction.category,
            ),
          } as Transaction),
      ),
    );

    await transactionsRepository.save(createdTransactions);
    await fs.promises.unlink(file.path);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
