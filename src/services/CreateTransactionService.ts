import { getCustomRepository, getRepository } from 'typeorm';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';
import AppError from '../errors/AppError';

interface TransactionRequest {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: TransactionRequest): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const { total } = await transactionsRepository.getBalance();
    if (type === 'outcome' && total < value) {
      throw new AppError('You got no money dude!');
    }

    const categoryRepository = getRepository(Category);
    let category_id = null;
    let foundCategory = await categoryRepository.findOne({
      where: { title: category },
    });

    if (foundCategory) {
      category_id = foundCategory.id;
    } else {
      const createdCategory = categoryRepository.create({ title: category });
      await categoryRepository.save(createdCategory);

      foundCategory = createdCategory;
      category_id = createdCategory.id;
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id,
      category: foundCategory,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
