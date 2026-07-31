interface ParentProps {
  colspan: number;
}

const RecordsNotFound = ({ colspan }: ParentProps) => {
  return (
    <tr>
      <td colSpan={colspan}>
        <div className="text-center py-10">No Records Found</div>
      </td>
    </tr>
  );
};

export default RecordsNotFound;
