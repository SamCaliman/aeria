import type * as AST from '../ast'
import { getCollectionProperties, stringify, makeASTImports, resizeFirstChar, aeriaPackageName } from './utils'

const initialImportedTypes = [
  'Collection',
  'SchemaWithId',
  'ExtendCollection',
  'Context',
]

export const generateTypescript = (ast: AST.Node[]): string => {
  let code = ''
  code += `import type { ${initialImportedTypes.join(', ')} } from '${aeriaPackageName}'\n` //Used types
  const importsResult = makeASTImports(ast)
  code += importsResult.code + '\n\n'
  code += makeTSCollections(ast, importsResult.modifiedSymbols) + '\n'
  return code
}

/** Creates the code exporting the collection type, declaration, schema and extend for each collection and returns them in a string */
const makeTSCollections = (ast: AST.Node[], modifiedSymbols: Record<string, string>) => {
  return ast.filter((node): node is AST.CollectionNode => node.type === 'collection')
    .map((collectionNode) => {
      const id = resizeFirstChar(collectionNode.name, false) //CollectionName -> collectionName
      const schemaName = resizeFirstChar(collectionNode.name, true) //collectionName -> CollectionName
      const typeName = id + 'Collection' //Pet -> petCollection

      const collectionType = `export declare type ${typeName} = ${
        id in modifiedSymbols ?
          `ExtendCollection<typeof ${modifiedSymbols[id]}, ${makeTSCollectionSchema(collectionNode, id)}>`
          : makeTSCollectionSchema(collectionNode, id)
      }`

      const collectionDeclaration = `export declare const ${id}: ${typeName} & { item: SchemaWithId<${typeName}["description"]> }`
      const collectionSchema = `export declare type ${schemaName} = SchemaWithId<typeof ${id}.description>`
      const collectionExtend = `export declare const extend${schemaName}Collection: <
            const TCollection extends {
              [P in Exclude<keyof Collection, "functions">]?: Partial<Collection[P]>
            } & {
              functions?: {
                [F: string]: (payload: any, context: Context<typeof ${id}["description"]>) => unknown
              }
            }>(collection: Pick<TCollection, keyof Collection>) => ExtendCollection<typeof ${id}, TCollection>`

      return [
        '//' + collectionNode.name,
        collectionType,
        collectionDeclaration,
        collectionSchema,
        collectionExtend,
      ].join('\n')
    }).join('\n\n')
}

const makeTSCollectionSchema = (collectionNode: AST.CollectionNode, collectionId: string) => stringify({
  description: {
    $id: collectionId,
    properties: getCollectionProperties(collectionNode.properties),
    ...(collectionNode.owned && {
      owned: collectionNode.owned ?? false,
    }),
  },
  ...(collectionNode.functions && {
    functions: makeTSFunctions(collectionNode.functions),
  }),
})

/** Turns each function to 'typeof functioName' if it's from aeria or  */
const makeTSFunctions = (functions: NonNullable<AST.CollectionNode['functions']>) => {
  return Object.keys(functions).reduce<Record<string, string>>((acc, key) => {
    acc[key] = functions[key].fromFunctionSet
      ? `typeof ${key}`
      : '() => never'
    return acc
  }, {})
}
