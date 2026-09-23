import useScaleUI from "./hooks/useScaleUI";

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);

  return (
    <main className="relative h-dvh w-full overflow-visible overscroll-none">
      <div
        ref={wrapperRef}
        className="relative h-dvh w-full overflow-hidden overscroll-none"
      >
        <div
          className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]"
        >
          <div
            ref={appRef}
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] flex flex-col justify-between overflow-visible pt-8 pb-15"
          ></div>
        </div>
      </div>
    </main>
  );
};

export default App;
