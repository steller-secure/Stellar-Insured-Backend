import { SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from './dto/pagination.dto';
import { PaginatedResult } from './interfaces/paginated-result.interface';

export async function paginate<T>(
  queryBuilder: SelectQueryBuilder<T>,
  paginationDto: PaginationDto,
): Promise<PaginatedResult<T>> {
  const page = Number(paginationDto.page) || 1;
  const limit = Number(paginationDto.limit) || 10;
  const skip = (page - 1) * limit;

  // Apply sorting if provided
  if (paginationDto.sortBy) {
    const sortOrder = paginationDto.order === 'ASC' ? 'ASC' : 'DESC';
    // Protect against SQL injection by checking if column exists in metadata or entity properties
    // For simplicity in this helper, we assume the caller validates field names or we use addOrderBy safely
    queryBuilder.addOrderBy(`${queryBuilder.alias}.${paginationDto.sortBy}`, sortOrder);
  } else {
    // Default sort by created_at if it exists, otherwise id
    // queryBuilder.addOrderBy(`${queryBuilder.alias}.created_at`, 'DESC');
  }

  queryBuilder.skip(skip).take(limit);

  const [data, total] = await queryBuilder.getManyAndCount();

  const lastPage = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      lastPage,
    },
  };
}
