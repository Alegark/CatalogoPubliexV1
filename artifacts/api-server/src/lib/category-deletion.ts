export type CategoryDeletionInput = {
  categoryId: number;
  productCount: number;
  replacementCategoryId: number | null;
  replacementExists: boolean;
};

export type CategoryDeletionError = {
  status: 400;
  message: string;
};

export function validateCategoryDeletion(
  input: CategoryDeletionInput,
): CategoryDeletionError | null {
  if (input.productCount > 0 && input.replacementCategoryId === null) {
    return {
      status: 400,
      message: "Selecciona una categoría destino para mover los productos.",
    };
  }

  if (
    input.replacementCategoryId !== null
    && input.replacementCategoryId === input.categoryId
  ) {
    return {
      status: 400,
      message: "La categoría destino debe ser diferente.",
    };
  }

  if (input.replacementCategoryId !== null && !input.replacementExists) {
    return {
      status: 400,
      message: "La categoría destino no existe.",
    };
  }

  return null;
}
